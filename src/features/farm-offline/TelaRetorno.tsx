import { useEffect } from 'react'

import { Botao } from '../../components/shared/Botao'
import { useSessao } from '../../context/SessaoContext'
import type { ChaveI18n } from '../../lib/i18n'
import type { MotivoRetorno } from '../../lib/tipos'
import { formatarDuracaoMinutos, formatarNumero } from '../../utils/formato'
import { useFarmOffline } from './useFarmOffline'
import './TelaRetorno.css'

// A tela mais importante do produto (CLAUDE.md, Princípio nº1): precisa ser
// legível de relance, sem exigir leitura. Por isso o número grande vem
// primeiro e a explicação vem depois, em texto pequeno.
//
// O tom nunca dá bronca por ter ficado offline (memory/identity.md) — quando
// não houve ganho, a tela informa o motivo e mostra o caminho, sem cobrança e
// sem contagem regressiva artificial (restrição ética contra dark pattern).

const CHAVE_MOTIVO: Record<MotivoRetorno, ChaveI18n> = {
  primeira_sessao: 'retorno.motivo.primeira_sessao',
  creditado: 'retorno.motivo.creditado',
  teto_assinante: 'retorno.motivo.teto_assinante',
  teto_anuncio: 'retorno.motivo.teto_anuncio',
  sem_desbloqueio: 'retorno.motivo.sem_desbloqueio',
  assinatura_vencida: 'retorno.motivo.assinatura_vencida',
}

interface Props {
  /**
   * Avisa quem está por fora que esta tela cobriu o jogo. O portal precisa
   * saber: um modal em cima do mundo é pausa, não gameplay.
   */
  aoMudarVisibilidade?: (visivel: boolean) => void
}

export function TelaRetorno({ aoMudarVisibilidade }: Props) {
  const { t, idioma } = useSessao()
  const { retorno, visivel, coletando, temGanho, fechar, coletarEFechar } = useFarmOffline()

  useEffect(() => {
    aoMudarVisibilidade?.(visivel)
  }, [visivel, aoMudarVisibilidade])

  if (!visivel || !retorno) return null

  const rendeu = retorno.minutosCreditados > 0 && temGanho

  return (
    <div className="retorno" role="dialog" aria-modal="true" aria-labelledby="retorno-titulo">
      <div className="retorno__cartao">
        <h2 className="retorno__titulo" id="retorno-titulo">
          {t('retorno.titulo')}
        </h2>

        <p className="retorno__tempo">
          {t('retorno.tempoFora', {
            tempo: formatarDuracaoMinutos(retorno.minutosDecorridos, t),
          })}
        </p>

        {rendeu ? (
          <>
            <div className="retorno__ganhos">
              <strong className="retorno__ganho retorno__ganho--xp">
                {t('retorno.xpGanho', { valor: formatarNumero(retorno.xpGanho, idioma) })}
              </strong>
              <strong className="retorno__ganho retorno__ganho--moeda">
                {t('retorno.moedaGanha', { valor: formatarNumero(retorno.moedaGanha, idioma) })}
              </strong>
            </div>

            <p className="retorno__rendido">
              {t('retorno.tempoRendido', {
                tempo: formatarDuracaoMinutos(retorno.minutosCreditados, t),
              })}
            </p>
          </>
        ) : (
          <div className="retorno__vazio">
            <h3 className="retorno__vazio-titulo">{t('retorno.vazio.titulo')}</h3>
            <p className="retorno__vazio-mensagem">{t('retorno.vazio.mensagem')}</p>
          </div>
        )}

        <p className="retorno__motivo">{t(CHAVE_MOTIVO[retorno.motivo])}</p>

        {rendeu ? (
          <Botao variante="recompensa" onClick={() => void coletarEFechar()} disabled={coletando}>
            {coletando ? t('retorno.coletando') : t('retorno.coletar')}
          </Botao>
        ) : (
          <Botao onClick={fechar}>{t('retorno.voltarAoJogo')}</Botao>
        )}
      </div>
    </div>
  )
}
