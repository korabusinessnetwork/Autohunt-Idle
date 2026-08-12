import { useCallback, useEffect, useMemo, useState } from 'react'

import { Botao } from '../../components/shared/Botao'
import { TelaCarregando, TelaErro } from '../../components/shared/EstadoTela'
import { useSessao } from '../../context/SessaoContext'
import type { ChaveI18n } from '../../lib/i18n'
import {
  definirAjuste,
  listarAjustes,
  type LinhaAjuste,
} from '../../lib/services/ajusteService'
import './ConsoleAjuste.css'

// Console de ajuste — a tela do dono (`specs/console-de-ajuste.md`).
//
// TRÊS COISAS AQUI NÃO SÃO LAYOUT, SÃO REGRA:
//
//   · **esta tela não protege nada.** Ela está no bundle que todo jogador
//     baixa, e é deliberado: esconder rota é obscuridade, e obscuridade não é
//     controle. Quem protege é o banco — `ajuste` não tem grant de UPDATE para
//     o client, e `definir_ajuste` confere admin de novo a cada chamada;
//   · **quem não é admin vê a tela recusar, com o motivo escrito.** Não some e
//     não mente (critério 10 da spec): sumir ensinaria que existe algo
//     escondido, e mentir é pior que recusar;
//   · **cada campo mostra faixa e descrição**, não só o número. Sem isso o
//     console vira um formulário de números mágicos, e quem mexer daqui a seis
//     meses não vai saber o que está mexendo.
//
// A faixa também é prevenção de erro (princípio nº 1): o campo já nasce com
// `min`/`max`, então o caminho comum nem chega a produzir uma recusa.

const ERRO: Record<string, ChaveI18n> = {
  NAO_AUTORIZADO: 'console.erro.NAO_AUTORIZADO',
  FORA_DA_FAIXA: 'console.erro.FORA_DA_FAIXA',
  AJUSTE_INEXISTENTE: 'console.erro.AJUSTE_INEXISTENTE',
  VALOR_INVALIDO: 'console.erro.VALOR_INVALIDO',
  AJUSTE_FALHOU: 'console.erro.AJUSTE_FALHOU',
  AJUSTES_NAO_CARREGARAM: 'console.erro.AJUSTES_NAO_CARREGARAM',
  CONFIGURACAO_AUSENTE: 'console.erro.CONFIGURACAO_AUSENTE',
}

const ROTULO_CATEGORIA: Record<LinhaAjuste['categoria'], ChaveI18n> = {
  heroi: 'console.categoria.heroi',
  inimigo: 'console.categoria.inimigo',
  mundo: 'console.categoria.mundo',
  economia: 'console.categoria.economia',
}

const ORDEM_CATEGORIA: LinhaAjuste['categoria'][] = ['heroi', 'inimigo', 'mundo', 'economia']

export function ConsoleAjuste({ aoFechar }: { aoFechar: () => void }) {
  const { t, snapshot } = useSessao()

  const [linhas, setLinhas] = useState<LinhaAjuste[] | null>(null)
  const [erroCarga, setErroCarga] = useState<ChaveI18n | null>(null)
  const [rascunho, setRascunho] = useState<Record<string, string>>({})
  const [ocupada, setOcupada] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ chave: string; texto: ChaveI18n; ok: boolean } | null>(null)

  const ehAdmin = snapshot?.jogador.admin ?? false

  const carregar = useCallback(async () => {
    const resposta = await listarAjustes()
    if (resposta.error) {
      setErroCarga(ERRO[resposta.error.codigo] ?? 'console.erro.AJUSTES_NAO_CARREGARAM')
      return
    }
    setLinhas(resposta.data ?? [])
    setErroCarga(null)
  }, [])

  useEffect(() => {
    // Carrega mesmo para não-admin: ele recebe só as linhas visuais, pela RLS,
    // e a tela consegue explicar o que é este lugar em vez de ficar em branco.
    void carregar()
  }, [carregar])

  const porCategoria = useMemo(() => {
    const mapa = new Map<LinhaAjuste['categoria'], LinhaAjuste[]>()
    for (const linha of linhas ?? []) {
      const grupo = mapa.get(linha.categoria) ?? []
      grupo.push(linha)
      mapa.set(linha.categoria, grupo)
    }
    return ORDEM_CATEGORIA.filter((categoria) => mapa.has(categoria)).map((categoria) => ({
      categoria,
      itens: mapa.get(categoria)!,
    }))
  }, [linhas])

  async function salvar(linha: LinhaAjuste) {
    const bruto = rascunho[linha.chave]
    const valor = bruto === undefined ? linha.valor : Number(bruto.replace(',', '.'))

    setOcupada(linha.chave)
    setAviso(null)
    try {
      const resposta = await definirAjuste(linha.chave, valor)
      if (resposta.error) {
        setAviso({
          chave: linha.chave,
          texto: ERRO[resposta.error.codigo] ?? 'console.erro.AJUSTE_FALHOU',
          ok: false,
        })
        return
      }
      if (!resposta.data?.aplicado) {
        setAviso({
          chave: linha.chave,
          texto: ERRO[resposta.data?.motivo ?? ''] ?? 'console.erro.AJUSTE_FALHOU',
          ok: false,
        })
        return
      }

      // Relê do servidor em vez de confiar no que digitei: é o servidor que diz
      // qual é o valor vigente, aqui como em todo o resto do jogo.
      await carregar()
      setRascunho((anterior) => {
        const copia = { ...anterior }
        delete copia[linha.chave]
        return copia
      })
      setAviso({ chave: linha.chave, texto: 'console.salvo', ok: true })
    } finally {
      setOcupada(null)
    }
  }

  return (
    <div className="console" role="dialog" aria-modal="true" aria-labelledby="console-titulo">
      <div className="console__cartao">
        <header className="console__topo">
          <h2 className="console__titulo" id="console-titulo">
            {t('console.titulo')}
          </h2>
          <Botao variante="discreta" onClick={aoFechar}>
            {t('console.fechar')}
          </Botao>
        </header>

        {/*
          A recusa só aparece quando o servidor JÁ RESPONDEU quem é a pessoa.
          Sem snapshot, "isto não é pra você" seria um palpite apresentado como
          fato — e o estado real (não conectou) está logo abaixo, escrito.
        */}
        {snapshot !== null && !ehAdmin && (
          <p className="console__negado" role="status">
            <strong>{t('console.negado.titulo')}</strong> {t('console.negado.mensagem')}
          </p>
        )}

        <p className="console__explicacao">{t('console.explicacao')}</p>

        {erroCarga && (
          <div className="console__estado">
            <TelaErro
              titulo={t('console.titulo')}
              mensagem={t(erroCarga)}
              rotuloAcao={t('app.erro.tentarDeNovo')}
              aoTentarDeNovo={() => void carregar()}
            />
          </div>
        )}

        {!erroCarga && linhas === null && (
          <div className="console__estado">
            <TelaCarregando mensagem={t('console.carregando')} />
          </div>
        )}

        {porCategoria.map(({ categoria, itens }) => (
          <section className="console__grupo" key={categoria}>
            <h3 className="console__grupoTitulo">{t(ROTULO_CATEGORIA[categoria])}</h3>

            {itens.map((linha) => (
              <div className="console__linha" key={linha.chave}>
                <label className="console__rotulo" htmlFor={`ajuste-${linha.chave}`}>
                  {linha.chave}
                  <span
                    className={`console__escopo console__escopo--${linha.escopo}`}
                    title={t(
                      linha.escopo === 'visual'
                        ? 'console.escopo.visual.ajuda'
                        : 'console.escopo.economico.ajuda',
                    )}
                  >
                    {t(
                      linha.escopo === 'visual'
                        ? 'console.escopo.visual'
                        : 'console.escopo.economico',
                    )}
                  </span>
                </label>

                {/* A descrição é o que impede o console de virar números
                    mágicos. Vem do servidor, junto com a faixa. */}
                <p className="console__descricao">{linha.descricao}</p>

                <div className="console__controle">
                  <input
                    id={`ajuste-${linha.chave}`}
                    className="console__campo"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={linha.minimo}
                    max={linha.maximo}
                    disabled={!ehAdmin || ocupada === linha.chave}
                    value={rascunho[linha.chave] ?? String(linha.valor)}
                    onChange={(evento) =>
                      setRascunho((anterior) => ({
                        ...anterior,
                        [linha.chave]: evento.target.value,
                      }))
                    }
                  />
                  <span className="console__faixa">
                    {t('console.faixa', { minimo: linha.minimo, maximo: linha.maximo })}
                  </span>
                  <Botao
                    onClick={() => void salvar(linha)}
                    disabled={!ehAdmin || ocupada === linha.chave}
                  >
                    {t('console.salvar')}
                  </Botao>
                </div>

                {aviso?.chave === linha.chave && (
                  <p
                    className={`console__aviso console__aviso--${aviso.ok ? 'ok' : 'erro'}`}
                    role="status"
                  >
                    {t(aviso.texto)}
                  </p>
                )}
              </div>
            ))}
          </section>
        ))}

        {ehAdmin && <p className="console__rodape">{t('console.rodape')}</p>}
      </div>
    </div>
  )
}
