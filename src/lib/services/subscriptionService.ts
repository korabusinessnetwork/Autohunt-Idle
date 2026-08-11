// Camada de serviço — assinatura.
//
// Este arquivo NÃO tem uma função "estado da assinatura". É deliberado: quem
// diz se a assinatura está valendo é o servidor, no bloco `assinatura` do
// snapshot (`montar_snapshot`), comparando `expira_em` com o `now()` do
// Postgres. Uma versão client-side dessa checagem usaria `Date.now()`, ou
// seja, o relógio da máquina do jogador — exatamente o que a regra do produto
// proíbe para o cálculo offline, e não há motivo para abrir exceção justamente
// no campo que decide quem tem 24h de farm por dia.
//
// A escrita é exclusividade do webhook do gateway
// (`supabase/functions/assinatura-webhook/`), com a `service_role`: a RPC
// `aplicar_evento_assinatura` tem EXECUTE revogado de `authenticated`, então o
// jogador não consegue se declarar assinante.
//
// Fase 1: nenhum gateway contratado (`memory/restrictions.md` adia item pago
// por padrão até decisão do dono). O roteamento por idioma já está decidido —
// Stripe para EN, Asaas para PT (`docs/01_ARQUITETURA/tech-stack.md`) — só
// falta a conta.

import { falha, type Envelope } from '../envelope'
import type { Idioma } from '../i18n'

/** Gateway que atenderia o jogador, decidido pelo idioma dele. */
export function gatewayPara(idioma: Idioma): 'stripe' | 'asaas' {
  return idioma === 'pt' ? 'asaas' : 'stripe'
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
