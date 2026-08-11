import { useState } from 'react'

import { Botao } from '../../components/shared/Botao'
import { useSessao } from '../../context/SessaoContext'
import type { ChaveI18n } from '../../lib/i18n'
import { obterPortal } from '../../lib/portal'
import { anuncioDisponivel, assistirAnuncio } from '../../lib/services/adService'
import { checkoutDisponivel } from '../../lib/services/subscriptionService'
import {
  deveAvisarSobreAssinatura,
  motivoIndisponibilidade,
  tituloDoPainel,
  type ContextoDesbloqueio,
} from './regras'
import './PainelDesbloqueio.css'

// Painel de desbloqueio de farm offline — os dois caminhos do core: assinatura
// (24h/dia + 2x XP) e anúncio recompensado (15min por anúncio, até 2h/dia).
//
// Transparência de monetização é restrição ética registrada
// (memory/restrictions.md): o teto aparece sempre, em número, e quando o
// anúncio não vai render nada o botão já sai desabilitado com o motivo.
//
// As decisões de exibição moram em `regras.ts`, puras e testadas — inclusive a
// que garante zero elemento de compra onde o canal proíbe.

interface Props {
  aoFechar: () => void
}

export function PainelDesbloqueio({ aoFechar }: Props) {
  const { t, snapshot, recarregarEstado } = useSessao()
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<ChaveI18n | null>(null)

  const contexto: ContextoDesbloqueio = {
    permiteCompraNoJogo: obterPortal().permiteCompraNoJogo,
    assinante: snapshot?.assinatura.ativa ?? false,
    saldo: snapshot?.farm.minutosAnuncioSaldo ?? 0,
    restantesHoje: snapshot?.farm.minutosAnuncioRestantes ?? 0,
    anuncioDisponivel: anuncioDisponivel(),
  }

  const bloqueio = motivoIndisponibilidade(contexto)

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

      // Quem creditou foi o servidor; o client só relê o estado para descobrir
      // quanto entrou de fato.
      await recarregarEstado()
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="desbloqueio" role="dialog" aria-modal="true" aria-labelledby="desbloqueio-titulo">
      <div className="desbloqueio__cartao">
        <h2 className="desbloqueio__titulo" id="desbloqueio-titulo">
          {t(tituloDoPainel(contexto))}
        </h2>

        <p className="desbloqueio__saldo">{t('anuncio.saldo', { minutos: contexto.saldo })}</p>
        {!contexto.assinante ? (
          <p className="desbloqueio__restante">
            {t('anuncio.restanteHoje', { minutos: contexto.restantesHoje })}
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

        {deveAvisarSobreAssinatura(contexto, checkoutDisponivel()) ? (
          <p className="desbloqueio__motivo">{t('assinatura.indisponivel')}</p>
        ) : null}

        <Botao variante="discreta" onClick={aoFechar}>
          {t('config.fechar')}
        </Botao>
      </div>
    </div>
  )
}
