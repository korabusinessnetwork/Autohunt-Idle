import { useState } from 'react'

import { Botao } from '../../components/shared/Botao'
import { useSessao } from '../../context/SessaoContext'
import type { ChaveI18n } from '../../lib/i18n'
import { anuncioDisponivel, assistirAnuncio } from '../../lib/services/adService'
import { checkoutDisponivel } from '../../lib/services/subscriptionService'
import { TETO_ANUNCIO_DIARIO_MIN } from '../../game/regrasFarm'
import './PainelDesbloqueio.css'

// Painel de desbloqueio de farm offline — os dois caminhos do core: assinatura
// (24h/dia + 2x XP) e anúncio recompensado (15min por anúncio, até 2h/dia).
//
// Transparência de monetização é restrição ética registrada
// (memory/restrictions.md): o teto aparece sempre, em número, e quando o
// anúncio não vai render nada o botão já sai desabilitado com o motivo — nunca
// se gasta o tempo do jogador num anúncio inútil (edge case do core).

interface Props {
  aoFechar: () => void
}

function motivoIndisponibilidade(
  assinante: boolean,
  saldo: number,
  restantesHoje: number,
): ChaveI18n | null {
  if (assinante) return 'anuncio.indisponivel.ASSINANTE_NAO_PRECISA'
  if (!anuncioDisponivel()) return 'anuncio.indisponivel.SEM_PROVEDOR'
  if (restantesHoje <= 0) return 'anuncio.indisponivel.TETO_DIARIO_ATINGIDO'
  if (saldo >= TETO_ANUNCIO_DIARIO_MIN) return 'anuncio.indisponivel.SALDO_JA_NO_TETO'
  return null
}

export function PainelDesbloqueio({ aoFechar }: Props) {
  const { t, snapshot, recarregarEstado } = useSessao()
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<ChaveI18n | null>(null)

  const assinante = snapshot?.assinatura.ativa ?? false
  const saldo = snapshot?.farm.minutosAnuncioSaldo ?? 0
  const restantesHoje = snapshot?.farm.minutosAnuncioRestantes ?? 0

  const bloqueio = motivoIndisponibilidade(assinante, saldo, restantesHoje)

  async function aoAssistir() {
    setOcupado(true)
    setAviso(null)
    try {
      const resposta = await assistirAnuncio()

      if (resposta.error) {
        setAviso(
          resposta.error.codigo === 'SEM_PROVEDOR'
            ? 'anuncio.indisponivel.SEM_PROVEDOR'
            : 'anuncio.erro',
        )
        return
      }

      if (resposta.data?.estado === 'nao_concluido') {
        setAviso('anuncio.erro')
        return
      }

      // O crédito vem do callback assinado do provedor, no servidor. O client
      // só relê o estado para descobrir o resultado — nunca o declara.
      await recarregarEstado()
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="desbloqueio" role="dialog" aria-modal="true" aria-labelledby="desbloqueio-titulo">
      <div className="desbloqueio__cartao">
        <h2 className="desbloqueio__titulo" id="desbloqueio-titulo">
          {t(assinante ? 'assinatura.ativa' : 'assinatura.inativa')}
        </h2>

        <p className="desbloqueio__saldo">{t('anuncio.saldo', { minutos: saldo })}</p>
        {!assinante ? (
          <p className="desbloqueio__restante">
            {t('anuncio.restanteHoje', { minutos: restantesHoje })}
          </p>
        ) : null}

        <Botao
          variante="recompensa"
          onClick={() => void aoAssistir()}
          disabled={ocupado || bloqueio !== null}
        >
          {ocupado ? t('anuncio.carregando') : t('anuncio.assistir', { minutos: 15 })}
        </Botao>

        {bloqueio ? <p className="desbloqueio__motivo">{t(bloqueio)}</p> : null}
        {aviso ? (
          <p className="desbloqueio__motivo desbloqueio__motivo--alerta" role="alert">
            {t(aviso)}
          </p>
        ) : null}

        {!assinante && !checkoutDisponivel() ? (
          <p className="desbloqueio__motivo">{t('assinatura.indisponivel')}</p>
        ) : null}

        <Botao variante="discreta" onClick={aoFechar}>
          {t('config.fechar')}
        </Botao>
      </div>
    </div>
  )
}
