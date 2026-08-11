// Camada de serviço — assinatura.
//
// Leitura só: o estado de assinatura é escrito exclusivamente pelo webhook do
// gateway (`supabase/functions/assinatura-webhook/`), com a `service_role`. A
// RPC `aplicar_evento_assinatura` tem EXECUTE revogado de `authenticated`, então
// o jogador não consegue se declarar assinante.
//
// Fase 1: nenhum gateway contratado (`memory/restrictions.md` adia item pago
// por padrão até decisão do dono). O roteamento por idioma já está decidido —
// Stripe para EN, Asaas para PT (`docs/01_ARQUITETURA/tech-stack.md`) — só
// falta a conta. `iniciarCheckout` recusa de forma legível em vez de abrir uma
// tela de pagamento que não existe.

import { deErroSupabase, falha, ok, type Envelope } from '../envelope'
import { obterSupabase } from '../supabaseClient'
import type { EstadoAssinatura, Idioma } from './tiposReexport'

/** Gateway que atenderia o jogador, decidido pelo idioma dele. */
export function gatewayPara(idioma: Idioma): 'stripe' | 'asaas' {
  return idioma === 'pt' ? 'asaas' : 'stripe'
}

export async function estadoAssinatura(playerId: string): Promise<Envelope<EstadoAssinatura>> {
  // Campos explícitos: nunca `select *` em tabela com dado de cobrança
  // (CLAUDE.md). `referencia_externa` fica fora de propósito — a UI não precisa
  // do identificador da cobrança no gateway.
  const { data, error } = await obterSupabase()
    .from('assinatura')
    .select('status, expira_em')
    .eq('player_id', playerId)
    .maybeSingle()

  if (error) return deErroSupabase<EstadoAssinatura>(error, 'ASSINATURA_FALHOU')

  const status = (data?.status ?? 'inexistente') as EstadoAssinatura['status']
  const expiraEm = (data?.expira_em ?? null) as string | null
  const ativa =
    (status === 'ativa' || status === 'cancelada') &&
    expiraEm !== null &&
    new Date(expiraEm).getTime() > Date.now()

  return ok<EstadoAssinatura>({
    ativa,
    status,
    expiraEm,
    multiplicadorXp: ativa ? 2 : 1,
    tetoOfflineMinutos: ativa ? 24 * 60 : 0,
  })
}

export type ResultadoCheckout = { url: string }

/**
 * Abriria o checkout do gateway. Sem conta contratada não há URL para abrir —
 * e devolver uma URL falsa seria pior do que dizer que ainda não está aberto.
 */
export async function iniciarCheckout(_idioma: Idioma): Promise<Envelope<ResultadoCheckout>> {
  return falha<ResultadoCheckout>(
    'GATEWAY_NAO_CONFIGURADO',
    'Nenhum gateway de pagamento está contratado nesta fase.',
  )
}

export function checkoutDisponivel(): boolean {
  return false
}
