// Camada de serviço — sessão e farm.
//
// REGRA INEGOCIÁVEL (ADR-001, memory/restrictions.md, CLAUDE.md): este arquivo
// nunca calcula recompensa e nunca manda tempo pro servidor. Repare que todas
// as chamadas abaixo passam um objeto de parâmetros VAZIO — não é descuido, é
// o contrato: as RPCs correspondentes não têm parâmetro nenhum, então não
// existe campo por onde o client declare quanto ganhou ou quanto tempo passou.

import { deErroSupabase, ok, type Envelope } from '../envelope'
import { obterSupabase } from '../supabaseClient'
import type { ResgateAnuncio, Snapshot, TicketAnuncio } from '../tipos'

/**
 * Reconnect: garante as linhas do jogador, aplica vencimento de assinatura,
 * resolve o farm offline pendente e devolve o snapshot com o bloco `retorno`
 * já formatado pelo servidor.
 */
export async function iniciarSessao(): Promise<Envelope<Snapshot>> {
  const { data, error } = await obterSupabase().rpc('iniciar_sessao', {})
  if (error) return deErroSupabase<Snapshot>(error, 'SESSAO_FALHOU')
  return ok(data as Snapshot)
}

/**
 * Validação em lote da sessão ao vivo (core, 15). Chamada a cada
 * `INTERVALO_LOTE_MS`; o servidor decide o rendimento do intervalo pelo próprio
 * relógio.
 */
export async function validarLote(): Promise<Envelope<Snapshot>> {
  const { data, error } = await obterSupabase().rpc('validar_lote', {})
  if (error) return deErroSupabase<Snapshot>(error, 'LOTE_FALHOU')
  return ok(data as Snapshot)
}

/**
 * Encerra a sessão ao vivo creditando o último lote.
 *
 * É best-effort de propósito: se o navegador for morto antes de a requisição
 * sair, o resultado é o mesmo, porque o servidor trata `last_seen_at` parado
 * como fim de sessão. Nenhuma regra depende deste aviso chegar.
 */
export async function encerrarSessao(): Promise<Envelope<Snapshot>> {
  const { data, error } = await obterSupabase().rpc('encerrar_sessao', {})
  if (error) return deErroSupabase<Snapshot>(error, 'ENCERRAMENTO_FALHOU')
  return ok(data as Snapshot)
}

/** Move o farm offline pendente para o total do jogador. */
export async function coletarFarmOffline(): Promise<Envelope<Snapshot>> {
  const { data, error } = await obterSupabase().rpc('coletar_farm_offline', {})
  if (error) return deErroSupabase<Snapshot>(error, 'COLETA_FALHOU')
  return ok(data as Snapshot)
}

export async function estadoJogador(): Promise<Envelope<Snapshot>> {
  const { data, error } = await obterSupabase().rpc('estado_jogador', {})
  if (error) return deErroSupabase<Snapshot>(error, 'ESTADO_FALHOU')
  return ok(data as Snapshot)
}

/**
 * Pede ao servidor autorização para assistir um anúncio.
 *
 * Chamado ANTES de mostrar o anúncio: quando o servidor recusa, a UI já avisa
 * o motivo em vez de queimar 30 segundos do jogador por nada (edge case do
 * core). O ticket devolvido é o que o callback do provedor resgata — o crédito
 * em si não passa por aqui.
 */
export async function emitirTicketAnuncio(): Promise<Envelope<TicketAnuncio>> {
  const { data, error } = await obterSupabase().rpc('emitir_ticket_anuncio', {})
  if (error) return deErroSupabase<TicketAnuncio>(error, 'TICKET_FALHOU')
  return ok(data as TicketAnuncio)
}

/**
 * Resgata um ticket depois que o SDK do canal informou que o anúncio terminou.
 *
 * O único dado enviado é o identificador opaco que o próprio servidor emitiu —
 * nunca minutos, nunca tempo, nunca recompensa. A Edge Function confere que o
 * ticket pertence a quem está pedindo, que ele nunca foi resgatado, e
 * reaplica todos os tetos antes de creditar qualquer coisa.
 *
 * Isto NÃO é o callback servidor-a-servidor que o critério 7 do core descreve:
 * a conclusão do anúncio é atestada pelo client, porque os SDKs da Poki e da
 * CrazyGames não oferecem outra via. Ver ADR-004 para a exposição residual e a
 * decisão pendente.
 */
export async function resgatarAnuncio(ticketId: string): Promise<Envelope<ResgateAnuncio>> {
  const { data, error } = await obterSupabase().functions.invoke('anuncio-resgate', {
    body: { ticketId },
  })
  if (error) return deErroSupabase<ResgateAnuncio>(error, 'RESGATE_FALHOU')
  return ok(data as ResgateAnuncio)
}

/**
 * Log de atividade — fire-and-forget. Nunca bloqueia a operação principal e
 * nunca carrega dado sensível (CLAUDE.md).
 */
export function registrarEvento(playerId: string, tipo: string, dados: unknown = {}): void {
  void obterSupabase()
    .from('evento_jogo')
    .insert({ player_id: playerId, tipo, dados })
    .then(() => undefined)
}
