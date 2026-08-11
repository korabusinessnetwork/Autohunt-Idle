// Camada de serviço — anúncio recompensado.
//
// O que este arquivo pode fazer: pedir um ticket ao servidor, mandar o SDK do
// canal exibir o anúncio, e apresentar o ticket de volta para resgate.
// O que ele NÃO pode fazer, por construção: dizer quantos minutos ganhou. Os
// tetos (15 min por ticket, 2h/dia, saldo máximo de 2h) são reaplicados no
// servidor a cada resgate, e a RPC de crédito tem EXECUTE revogado de
// `authenticated` — o token do jogador não a alcança.
//
// RESSALVA IMPORTANTE (ver ADR-004): o critério 7 do core pede que a conclusão
// do anúncio chegue por callback servidor-a-servidor. Os SDKs da Poki e da
// CrazyGames são client-side e não oferecem isso. O que existe aqui é a
// mitigação mais forte possível nesses canais — não é o que o critério 7 pede,
// e a diferença está documentada, não escondida.

import { obterPortal, sinalizarJogo } from '../portal'
import type { Envelope } from '../envelope'
import { falha, ok } from '../envelope'
import { emitirTicketAnuncio, resgatarAnuncio } from './farmService'
import type { TicketAnuncio } from '../tipos'

export type { ProvedorAnuncio } from '../portal'

export type ResultadoAnuncio =
  | { estado: 'creditado'; minutos: number }
  | { estado: 'nao_concluido' }

/** Se dá para oferecer um anúncio agora — canal, SDK presente e nenhum em curso. */
export function anuncioDisponivel(): boolean {
  return obterPortal().provedorAnuncio?.disponivel() ?? false
}

/**
 * Fluxo completo: autorização do servidor → exibição pelo SDK do canal →
 * resgate no servidor.
 *
 * Repare na ordem: o ticket vem ANTES do anúncio. É o que garante que o
 * jogador nunca gaste 30 segundos assistindo algo que não renderia nada (edge
 * case do core) — quando o servidor recusa, nem chega a exibir.
 */
export async function assistirAnuncio(): Promise<Envelope<ResultadoAnuncio>> {
  const portal = obterPortal()
  const provedor = portal.provedorAnuncio

  if (!provedor?.disponivel()) {
    return falha<ResultadoAnuncio>('SEM_PROVEDOR', 'Nenhum provedor de anúncio disponível.')
  }

  const ticket: Envelope<TicketAnuncio> = await emitirTicketAnuncio()
  if (ticket.error) return falha<ResultadoAnuncio>(ticket.error.codigo, ticket.error.mensagem)

  const permissao = ticket.data
  if (!permissao?.emitido || !permissao.ticketId) {
    return falha<ResultadoAnuncio>(
      permissao?.motivo ?? 'TICKET_RECUSADO',
      'O servidor não autorizou um novo anúncio agora.',
    )
  }

  // Quebra comercial é pausa de jogo — o portal precisa saber.
  sinalizarJogo(false)
  let desfecho
  try {
    desfecho = await provedor.exibir(permissao.ticketId)
  } finally {
    sinalizarJogo(true)
  }

  if (desfecho !== 'concluido') {
    // Anúncio fechado no meio não credita: o ticket fica sem resgate e expira
    // sozinho em 30 minutos.
    return ok<ResultadoAnuncio>({ estado: 'nao_concluido' })
  }

  const resgate = await resgatarAnuncio(permissao.ticketId)
  if (resgate.error) return falha<ResultadoAnuncio>(resgate.error.codigo, resgate.error.mensagem)

  if (!resgate.data?.creditado) {
    return falha<ResultadoAnuncio>(
      resgate.data?.motivo ?? 'RESGATE_RECUSADO',
      'O servidor recusou o resgate deste ticket.',
    )
  }

  return ok<ResultadoAnuncio>({ estado: 'creditado', minutos: resgate.data.minutos ?? 0 })
}
