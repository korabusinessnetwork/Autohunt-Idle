// Edge Function — webhook de assinatura do gateway de pagamento.
//
// Única porta pela qual o estado de assinatura muda. A RPC
// `aplicar_evento_assinatura` tem EXECUTE revogado de `anon`/`authenticated`,
// então o jogador não consegue se declarar assinante.
//
// Estado da Fase 1: nenhum gateway contratado (`memory/restrictions.md` adia
// item pago por padrão). `GATEWAY_PROVIDER` vazio faz a função recusar tudo.
// Os adapters `stripe` e `asaas` estão declarados mas não implementados — o
// roteamento por idioma já está decidido (`docs/01_ARQUITETURA/tech-stack.md`),
// só falta a conta, e implementar o parse de um payload que ninguém pode testar
// seria código morto pretendendo estar pronto.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { assinaturaValida, respostaJson } from '../_shared/assinatura.ts'

/** Evento normalizado, independente de gateway. */
interface EventoAssinatura {
  playerId: string
  /**
   * 'cancelada' = o jogador pediu para cancelar, mas o período pago continua
   * valendo até `expiraEm`. Só 'vencida' zera o progresso pendente — a
   * distinção é o critério 9 do core, não um detalhe de implementação.
   */
  status: 'ativa' | 'cancelada' | 'vencida'
  expiraEm: string | null
  referencia: string | null
}

type Adapter = (corpo: unknown) => EventoAssinatura | null

const ADAPTERS: Record<string, Adapter> = {
  dev: (corpo) => {
    const c = corpo as Partial<EventoAssinatura>
    if (typeof c?.playerId !== 'string') return null
    if (c.status !== 'ativa' && c.status !== 'cancelada' && c.status !== 'vencida') return null
    return {
      playerId: c.playerId,
      status: c.status,
      expiraEm: typeof c.expiraEm === 'string' ? c.expiraEm : null,
      referencia: typeof c.referencia === 'string' ? c.referencia : null,
    }
  },
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return respostaJson({ erro: 'METODO_NAO_PERMITIDO' }, 405)
  }

  const provedor = Deno.env.get('GATEWAY_PROVIDER') ?? ''
  const segredo = Deno.env.get('GATEWAY_WEBHOOK_SECRET') ?? ''
  const adapter = ADAPTERS[provedor]

  if (!provedor || !segredo || !adapter) {
    return respostaJson({ erro: 'GATEWAY_NAO_CONFIGURADO' }, 503)
  }

  const corpoCru = await req.text()
  if (!(await assinaturaValida(corpoCru, req.headers.get('x-assinatura'), segredo))) {
    return respostaJson({ erro: 'ASSINATURA_INVALIDA' }, 401)
  }

  let corpo: unknown
  try {
    corpo = JSON.parse(corpoCru)
  } catch {
    return respostaJson({ erro: 'CORPO_INVALIDO' }, 400)
  }

  const evento = adapter(corpo)
  if (!evento) {
    return respostaJson({ erro: 'CORPO_INVALIDO' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data, error } = await supabase.rpc('aplicar_evento_assinatura', {
    p_player_id: evento.playerId,
    p_status: evento.status,
    p_expira_em: evento.expiraEm,
    p_provedor: provedor === 'dev' ? null : provedor,
    p_referencia: evento.referencia,
  })

  if (error) {
    // Nunca logar o corpo: ele carrega referência de cobrança do jogador.
    console.error('assinatura.webhook_falhou', error.code, error.message)
    return respostaJson({ erro: 'FALHA_AO_APLICAR' }, 500)
  }

  return respostaJson(data, 200)
})
