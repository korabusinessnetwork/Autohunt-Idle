import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { Botao } from '../../components/shared/Botao'
import { TelaCarregando, TelaErro, TelaVazia } from '../../components/shared/EstadoTela'
import { Paginacao, usePaginacao } from '../../components/shared/ListaPaginada'
import { useSessao } from '../../context/SessaoContext'
import type { ChaveI18n } from '../../lib/i18n'
import { definirApelido, rankingGlobal } from '../../lib/services/rankingService'
import type { RankingGlobal } from '../../lib/tipos'
import { formatarNumero } from '../../utils/formato'
import './TelaRanking.css'

// Ranking global.
//
// O apelido é pedido AQUI, não na primeira sessão: o critério 4 de
// `specs/ranking-global.md` pedia "no primeiro acesso", mas isso colidiria com
// o critério 17 do core ("abre direto no mundo, sem escolha inicial") e com o
// Princípio nº1 — e a própria spec de ranking resolve a contradição nos edge
// cases ("jogador sem nickname não aparece no ranking até definir").
//
// Consequência boa: não ter apelido é o opt-out do placar público, e escolher
// um é o opt-in explícito.

const ERRO_APELIDO: Record<string, ChaveI18n> = {
  APELIDO_TAMANHO_INVALIDO: 'ranking.apelido.erro.APELIDO_TAMANHO_INVALIDO',
  APELIDO_CARACTERE_INVALIDO: 'ranking.apelido.erro.APELIDO_CARACTERE_INVALIDO',
  APELIDO_EM_USO: 'ranking.apelido.erro.APELIDO_EM_USO',
  APELIDO_FALHOU: 'ranking.apelido.erro.APELIDO_FALHOU',
}

interface Props {
  aoFechar: () => void
  /** Chamado quando o jogador quer entrar no placar mas ainda é anônimo. */
  aoPedirCadastro: () => void
}

export function TelaRanking({ aoFechar, aoPedirCadastro }: Props) {
  const { t, idioma, snapshot, atualizarSnapshot } = useSessao()

  const [ranking, setRanking] = useState<RankingGlobal | null>(null)
  const [estado, setEstado] = useState<'carregando' | 'erro' | 'pronto'>('carregando')
  const [apelido, setApelido] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erroApelido, setErroApelido] = useState<ChaveI18n | null>(null)

  // O top do ranking é a lista mais longa do jogo (até 100 nomes). Não rola:
  // vira página, com quantas linhas couberem na altura do cartão.
  const paginado = usePaginacao<RankingGlobal['top'][number], HTMLOListElement>(ranking?.top ?? [])

  const temApelido = Boolean(snapshot?.jogador.apelido)
  // Apelido é único e ninguém mais pode usar — então precisa de uma conta que
  // não se perca junto com o `localStorage`. Mesmo princípio do critério 18 do
  // core: cadastro só é pedido quando a identidade permanente é necessária.
  const podeEscolherApelido = snapshot?.jogador.identidadeVerificada ?? false

  const carregar = useCallback(async () => {
    setEstado('carregando')
    const resposta = await rankingGlobal()
    if (resposta.error || !resposta.data) {
      setEstado('erro')
      return
    }
    setRanking(resposta.data)
    setEstado('pronto')
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function aoDefinirApelido(evento: FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setErroApelido(null)
    try {
      const resposta = await definirApelido(apelido)
      if (resposta.error) {
        setErroApelido(ERRO_APELIDO[resposta.error.codigo] ?? 'ranking.apelido.erro.APELIDO_FALHOU')
        return
      }
      if (resposta.data) atualizarSnapshot(resposta.data)
      await carregar()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="ranking" role="dialog" aria-modal="true" aria-labelledby="ranking-titulo">
      <div className="ranking__cartao">
        <h2 className="ranking__titulo" id="ranking-titulo">
          {t('ranking.titulo')}
        </h2>

        {!temApelido && !podeEscolherApelido ? (
          <div className="ranking__apelido">
            <h3 className="ranking__apelido-titulo">{t('ranking.cadastro.titulo')}</h3>
            <p className="ranking__apelido-explicacao">{t('ranking.cadastro.explicacao')}</p>
            <Botao onClick={aoPedirCadastro}>{t('ranking.cadastro.criar')}</Botao>
          </div>
        ) : null}

        {!temApelido && podeEscolherApelido ? (
          <form className="ranking__apelido" onSubmit={(e) => void aoDefinirApelido(e)}>
            <h3 className="ranking__apelido-titulo">{t('ranking.apelido.titulo')}</h3>
            <p className="ranking__apelido-explicacao">{t('ranking.apelido.explicacao')}</p>

            <label className="ranking__campo">
              <span>{t('ranking.apelido.campo')}</span>
              <input
                type="text"
                required
                minLength={3}
                maxLength={20}
                value={apelido}
                onChange={(e) => setApelido(e.target.value)}
              />
            </label>

            {erroApelido ? (
              <p className="ranking__erro" role="alert">
                {t(erroApelido)}
              </p>
            ) : null}

            <Botao type="submit" disabled={enviando}>
              {enviando ? t('ranking.apelido.enviando') : t('ranking.apelido.enviar')}
            </Botao>
          </form>
        ) : null}

        {estado === 'carregando' ? <TelaCarregando mensagem={t('ranking.carregando')} /> : null}

        {estado === 'erro' ? (
          <TelaErro
            titulo={t('ranking.erro')}
            mensagem={t('app.erro.mensagem')}
            rotuloAcao={t('app.erro.tentarDeNovo')}
            aoTentarDeNovo={() => void carregar()}
          />
        ) : null}

        {estado === 'pronto' && ranking ? (
          ranking.top.length === 0 ? (
            <TelaVazia titulo={t('ranking.vazio.titulo')} mensagem={t('ranking.vazio.mensagem')} />
          ) : (
            <>
              <ol className="ranking__lista lista-paginada" ref={paginado.alvo}>
                {paginado.itensDaPagina.map((linha) => (
                  <li
                    key={`${linha.posicao}-${linha.apelido}`}
                    className={`ranking__linha ${linha.euMesmo ? 'ranking__linha--eu' : ''}`}
                  >
                    <span className="ranking__posicao">
                      {t('ranking.posicao', { posicao: linha.posicao })}
                    </span>
                    <span className="ranking__apelido-nome">{linha.apelido}</span>
                    <span className="ranking__nivel">
                      {t('ranking.nivel', { nivel: formatarNumero(linha.nivel, idioma) })}
                    </span>
                  </li>
                ))}
              </ol>

              <Paginacao
                pagina={paginado.pagina}
                paginas={paginado.paginas}
                irPara={paginado.irPara}
              />

              {/* A própria posição aparece sempre, inclusive fora do top 100. */}
              {ranking.eu && !ranking.top.some((linha) => linha.euMesmo) ? (
                <p className="ranking__minha-posicao">
                  {t('ranking.suaPosicao', { posicao: ranking.eu.posicao })}
                </p>
              ) : null}
            </>
          )
        ) : null}

        <Botao variante="discreta" onClick={aoFechar}>
          {t('config.fechar')}
        </Botao>
      </div>
    </div>
  )
}
