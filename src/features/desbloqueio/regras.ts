import type { ChaveI18n } from '../../lib/i18n'
import { TETO_ANUNCIO_DIARIO_MIN } from '../../game/regrasFarm'

// Regras de exibição do painel de desbloqueio — puras, para poderem ser
// testadas sem montar componente.
//
// Duas coisas dependem delas e reprovam na revisão do portal se saírem
// erradas: mostrar elemento de compra onde o canal proíbe, e oferecer um
// anúncio que não renderia nada.

export interface ContextoDesbloqueio {
  /** O canal atual permite qualquer elemento de compra dentro do jogo? */
  permiteCompraNoJogo: boolean
  assinante: boolean
  /** Minutos de farm offline já desbloqueados e ainda não gastos. */
  saldo: number
  /** Quanto ainda dá para desbloquear na janela de 24h corrente. */
  restantesHoje: number
  /** O SDK de anúncio do canal está presente e livre agora? */
  anuncioDisponivel: boolean
}

/**
 * Título do painel.
 *
 * Onde o canal proíbe compra, o título nem menciona assinatura — a Poki proíbe
 * qualquer elemento de compra, sem exceção, e não é só o botão que precisa
 * sumir (`docs/01_ARQUITETURA/publicacao-portais.md`).
 */
export function tituloDoPainel(ctx: ContextoDesbloqueio): ChaveI18n {
  if (!ctx.permiteCompraNoJogo) return 'desbloqueio.titulo'
  return ctx.assinante ? 'assinatura.ativa' : 'assinatura.inativa'
}

/** Se cabe avisar que a assinatura ainda não abriu. */
export function deveAvisarSobreAssinatura(
  ctx: ContextoDesbloqueio,
  checkoutDisponivel: boolean,
): boolean {
  return ctx.permiteCompraNoJogo && !ctx.assinante && !checkoutDisponivel
}

/**
 * Por que o anúncio não pode ser oferecido agora — `null` quando pode.
 *
 * Existe para o jogador nunca gastar 30 segundos num anúncio que não renderia
 * nada (edge case do core): quando há motivo, o botão já sai desabilitado com
 * a explicação.
 */
export function motivoIndisponibilidade(ctx: ContextoDesbloqueio): ChaveI18n | null {
  if (ctx.assinante) return 'anuncio.indisponivel.ASSINANTE_NAO_PRECISA'
  if (!ctx.anuncioDisponivel) return 'anuncio.indisponivel.SEM_PROVEDOR'
  if (ctx.restantesHoje <= 0) return 'anuncio.indisponivel.TETO_DIARIO_ATINGIDO'
  if (ctx.saldo >= TETO_ANUNCIO_DIARIO_MIN) return 'anuncio.indisponivel.SALDO_JA_NO_TETO'
  return null
}
