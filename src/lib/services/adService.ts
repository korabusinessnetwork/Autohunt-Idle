// Camada de serviço — anúncio recompensado.
//
// O que este arquivo pode fazer: pedir um ticket ao servidor e mandar o SDK do
// provedor exibir o anúncio.
// O que ele NÃO pode fazer, por construção: creditar minutos. O crédito só
// acontece na Edge Function `anuncio-callback`, depois de conferir a assinatura
// HMAC do provedor, e a RPC `creditar_anuncio` tem EXECUTE revogado de
// `authenticated` — o token do jogador não alcança (core, 7).
//
// Fase 1: nenhum provedor real plugado. A escolha de canal está em aberto (a
// Poki proíbe IAP, a CrazyGames exige Xsolla e é por convite — ver
// `memory/restrictions.md`), então `PROVEDOR_ATIVO` é `null` e a UI mostra o
// botão como indisponível em vez de fingir que funciona.

import type { Envelope } from '../envelope'
import { falha, ok } from '../envelope'
import { emitirTicketAnuncio } from './farmService'
import type { TicketAnuncio } from '../tipos'

/** Contrato que qualquer SDK de anúncio precisa satisfazer para ser plugado. */
export interface ProvedorAnuncio {
  nome: string
  /**
   * Exibe o anúncio recompensado e resolve quando ele termina.
   * O `ticketId` é repassado ao provedor para voltar no callback assinado — é
   * assim que o servidor sabe de quem é o crédito sem confiar no client.
   */
  exibir(ticketId: string): Promise<'concluido' | 'interrompido' | 'erro'>
}

/**
 * Nenhum provedor contratado nesta fase. Plugar um é atribuir uma
 * implementação aqui e configurar `AD_PROVIDER` + `AD_CALLBACK_SECRET` no
 * servidor — o resto do fluxo já está pronto.
 */
export const PROVEDOR_ATIVO: ProvedorAnuncio | null = null

export type ResultadoAnuncio =
  | { estado: 'aguardando_callback'; ticketId: string; minutos: number }
  | { estado: 'nao_concluido' }

export function anuncioDisponivel(): boolean {
  return PROVEDOR_ATIVO !== null
}

/**
 * Fluxo completo do lado do client: pede autorização → exibe → espera o
 * callback do provedor creditar no servidor.
 *
 * Note que o retorno de sucesso é `aguardando_callback`, não "creditado": quem
 * credita é o servidor, e a UI só descobre o resultado relendo o estado.
 */
export async function assistirAnuncio(): Promise<Envelope<ResultadoAnuncio>> {
  if (!PROVEDOR_ATIVO) {
    return falha<ResultadoAnuncio>('SEM_PROVEDOR', 'Nenhum provedor de anúncio configurado.')
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

  const desfecho = await PROVEDOR_ATIVO.exibir(permissao.ticketId)
  if (desfecho !== 'concluido') {
    // Anúncio fechado no meio não credita: o ticket fica sem resgate e expira.
    return ok<ResultadoAnuncio>({ estado: 'nao_concluido' })
  }

  return ok<ResultadoAnuncio>({
    estado: 'aguardando_callback',
    ticketId: permissao.ticketId,
    minutos: permissao.minutos ?? 0,
  })
}
