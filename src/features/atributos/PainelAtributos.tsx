import { useState } from 'react'

import { Botao } from '../../components/shared/Botao'
import { useSessao } from '../../context/SessaoContext'
import {
  ATRIBUTOS,
  atributosZerados,
  custoDoProximoNivel,
  pontosDisponiveis,
  validarAlocacao,
  type Atributo,
  type Atributos,
} from '../../game/regrasAtributos'
import { ATRIBUTO_DO_DANO } from '../../game/regrasEquipamento'
import type { ChaveI18n } from '../../lib/i18n'
import { redistribuirAtributos } from '../../lib/services/atributoService'
import './PainelAtributos.css'

// Painel de atributos.
//
// Regra de produto que molda esta tela: **quem gasta ponto é o jogador**. Até
// 2026-08-13 o servidor distribuía sozinho e esta tela era opcional; hoje é
// aqui que a build acontece, e o ponto fica guardado até alguém decidir.
//
// O Princípio nº1 é atendido pelo selo no ícone de atributos (`Jogo.tsx`), que
// mostra quantos pontos estão parados — o convite chega sem exigir leitura, e
// ignorar não quebra nada.
//
// Como o respec é grátis, sem penalidade e sem limite (`specs/ranking-global.md`,
// critério 10), não existe confirmação de "tem certeza?": não há nada a perder.
//
// O SELO "sua arma" é o Princípio nº1 desta tela. Antes, gastar ponto no
// atributo errado custava metade do rendimento; hoje o atributo que não casa com
// a arma conta ZERO — errar deixou de ser ineficiência e virou desperdício
// total. Como prevenção de erro vale mais que mensagem de erro, a tela aponta,
// antes do clique, qual das linhas é a da arma que o jogador está usando.

const ROTULO: Record<Atributo, ChaveI18n> = {
  forca: 'atributos.forca',
  destreza: 'atributos.destreza',
  inteligencia: 'atributos.inteligencia',
  vitalidade: 'atributos.vitalidade',
  sorte: 'atributos.sorte',
}

const EFEITO: Record<Atributo, ChaveI18n> = {
  forca: 'atributos.forca.efeito',
  destreza: 'atributos.destreza.efeito',
  inteligencia: 'atributos.inteligencia.efeito',
  vitalidade: 'atributos.vitalidade.efeito',
  sorte: 'atributos.sorte.efeito',
}

const ERRO: Record<string, ChaveI18n> = {
  PONTOS_INSUFICIENTES: 'atributos.erro.PONTOS_INSUFICIENTES',
  ATRIBUTO_INVALIDO: 'atributos.erro.ATRIBUTO_INVALIDO',
  ATRIBUTO_FALHOU: 'atributos.erro.ATRIBUTO_FALHOU',
}

export function PainelAtributos({ aoFechar }: { aoFechar: () => void }) {
  const { t, snapshot, atualizarSnapshot } = useSessao()

  // Lido campo a campo, este objeto esquecia o atributo seguinte que nascesse —
  // e o buraco não aparece em teste nenhum: `custoAcumulado(undefined)` devolve
  // NaN em silêncio, porque o guarda `nivel <= 0` não pega `undefined`. Iterando
  // `ATRIBUTOS`, a lista canônica passa a ser a única fonte.
  const salvos: Atributos = atributosZerados()
  for (const chave of ATRIBUTOS) salvos[chave] = snapshot?.atributos[chave] ?? 0

  const nivel = snapshot?.jogador.nivel ?? 1

  // Qual linha é a da arma que ele está usando agora.
  //
  // SEM ARMA EQUIPADA, NENHUMA linha é marcada. O cálculo de poder tem um
  // default legítimo (arma ausente conta como 'fisico'), mas copiar esse default
  // para cá apontaria Força para quem está de punho — e tela que afirma algo
  // falso é pior do que tela que não afirma nada.
  const tipoDanoDaArma = snapshot?.inventario.loadout.arma?.tipoDano ?? null
  const atributoDaArma = tipoDanoDaArma ? ATRIBUTO_DO_DANO[tipoDanoDaArma] : null

  const [rascunho, setRascunho] = useState<Atributos>(salvos)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<ChaveI18n | null>(null)

  const livres = pontosDisponiveis(rascunho, nivel)
  const alterado = ATRIBUTOS.some((chave) => rascunho[chave] !== salvos[chave])

  function subir(chave: Atributo) {
    const custo = custoDoProximoNivel(rascunho[chave])
    if (custo > livres) return
    setRascunho({ ...rascunho, [chave]: rascunho[chave] + 1 })
    setErro(null)
  }

  function descer(chave: Atributo) {
    if (rascunho[chave] <= 0) return
    setRascunho({ ...rascunho, [chave]: rascunho[chave] - 1 })
    setErro(null)
  }

  function zerar() {
    // `atributosZerados()` e não um literal: um literal escrito à mão aqui
    // deixaria de fora o próximo atributo e passaria batido no vitest, que não
    // faz typecheck.
    setRascunho(atributosZerados())
    setErro(null)
  }

  async function salvar() {
    const validacao = validarAlocacao(rascunho, nivel)
    if (!validacao.valida) {
      setErro(ERRO[validacao.erro] ?? 'atributos.erro.ATRIBUTO_FALHOU')
      return
    }

    setSalvando(true)
    setErro(null)
    try {
      const resposta = await redistribuirAtributos(rascunho)
      if (resposta.error) {
        setErro(ERRO[resposta.error.codigo] ?? 'atributos.erro.ATRIBUTO_FALHOU')
        return
      }
      if (resposta.data) atualizarSnapshot(resposta.data)
      aoFechar()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="atributos" role="dialog" aria-modal="true" aria-labelledby="atributos-titulo">
      <div className="atributos__cartao">
        <h2 className="atributos__titulo" id="atributos-titulo">
          {t('atributos.titulo')}
        </h2>
        <p className="atributos__explicacao">{t('atributos.manual')}</p>
        <p className="atributos__pontos">{t('atributos.pontosLivres', { pontos: livres })}</p>

        <ul className="atributos__lista">
          {ATRIBUTOS.map((chave) => {
            const custo = custoDoProximoNivel(rascunho[chave])
            const daArma = chave === atributoDaArma
            return (
              <li
                key={chave}
                className={`atributos__linha ${daArma ? 'atributos__linha--daArma' : ''}`.trim()}
              >
                <div className="atributos__info">
                  {/* O selo é TEXTO, não ícone: `Icone` é decorativo por
                      construção (`aria-hidden`) e não aceita rótulo, e um
                      símbolo sozinho aqui exigiria legenda — o oposto do
                      Princípio nº1. */}
                  <span className="atributos__nome">
                    <strong>{t(ROTULO[chave])}</strong>
                    {daArma ? (
                      <span className="atributos__selo">{t('atributos.suaArma')}</span>
                    ) : null}
                  </span>
                  <span className="atributos__efeito">{t(EFEITO[chave])}</span>
                </div>

                <div className="atributos__controles">
                  <button
                    type="button"
                    className="atributos__passo"
                    onClick={() => descer(chave)}
                    disabled={rascunho[chave] <= 0 || salvando}
                    aria-label={t('atributos.descer', { atributo: t(ROTULO[chave]) })}
                  >
                    −
                  </button>
                  <span className="atributos__valor">{rascunho[chave]}</span>
                  <button
                    type="button"
                    className="atributos__passo"
                    onClick={() => subir(chave)}
                    disabled={custo > livres || salvando}
                    aria-label={t('atributos.subir', { atributo: t(ROTULO[chave]) })}
                  >
                    +
                  </button>
                </div>

                <span className="atributos__custo">{t('atributos.custoProximo', { custo })}</span>
              </li>
            )
          })}
        </ul>

        {erro ? (
          <p className="atributos__erro" role="alert">
            {t(erro)}
          </p>
        ) : null}

        <div className="atributos__acoes">
          <Botao onClick={() => void salvar()} disabled={!alterado || salvando}>
            {salvando ? t('atributos.salvando') : t('atributos.salvar')}
          </Botao>
          <Botao variante="discreta" onClick={zerar} disabled={salvando}>
            {t('atributos.zerar')}
          </Botao>
          <Botao variante="discreta" onClick={aoFechar} disabled={salvando}>
            {t('config.fechar')}
          </Botao>
        </div>

        {!alterado ? <p className="atributos__dica">{t('atributos.semAlteracao')}</p> : null}
      </div>
    </div>
  )
}
