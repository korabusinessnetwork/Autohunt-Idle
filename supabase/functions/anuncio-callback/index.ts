// Edge Function — callback de conclusão de anúncio recompensado.
//
// Esta é a ÚNICA porta pela qual minutos de anúncio entram no sistema
// (`specs/game-idle-farm-core.md`, critério 7). A RPC `creditar_anuncio` tem
// EXECUTE revogado de `anon` e `authenticated`, então nem um jogador com token
// válido credita a si mesmo — só esta função, com a `service_role`, e só depois
// de conferir a assinatura HMAC do provedor.
//
// Estado da Fase 1: nenhum provedor real está plugado. `AD_PROVIDER` vazio faz
// a função recusar tudo, que é o comportamento honesto enquanto a escolha de
// canal está em aberto (a Poki proíbe IAP; a CrazyGames exige Xsolla — ver
// `memory/restrictions.md`). O adapter `dev` existe para testar o fluxo local
// sem contratar nada: o segredo vive só no servidor, então o client continua
// sem conseguir forjar crédito.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { assinaturaValida, respostaJson } from '../_shared/assinatura.ts'

/** Payload normalizado que a função entende, qualquer que seja o provedor. */
interface CallbackAnuncio {
  ticketId: string
  status: 'concluido' | 'interrompido' | 'erro'
}

/**
 * Adapters por provedor. Cada um traduz o corpo cru do provedor para o formato
 * normalizado acima. Plugar Poki/CrazyGames/AdSense é acrescentar uma entrada
 * aqui e o segredo em `AD_CALLBACK_SECRET` — nada mais do fluxo muda.
 */
const ADAPTERS: Record<string, (corpo: unknown) => CallbackAnuncio | null> = {
  dev: (corpo) => {
    const c = corpo as Partial<CallbackAnuncio>
    if (typeof c?.ticketId !== 'string') return null
    if (c.status !== 'concluido' && c.status !== 'interrompido' && c.status !== 'erro') {
      return null
    }
    return { ticketId: c.ticketId, status: c.status }
  },
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return respostaJson({ erro: 'METODO_NAO_PERMITIDO' }, 405)
  }

  const provedor = Deno.env.get('AD_PROVIDER') ?? ''
  const segredo = Deno.env.get('AD_CALLBACK_SECRET') ?? ''
  const adapter = ADAPTERS[provedor]

  // Sem provedor configurado não existe crédito de anúncio. Recusar é o
  // comportamento correto: um "default permissivo" aqui seria a falha.
  if (!provedor || !segredo || !adapter) {
    return respostaJson({ erro: 'PROVEDOR_DE_ANUNCIO_NAO_CONFIGURADO' }, 503)
  }

  // O corpo precisa ser lido cru: a assinatura é sobre os bytes exatos que o
  // provedor assinou, não sobre o JSON reserializado.
  const corpoCru = await req.text()
  const assinatura = req.headers.get('x-assinatura')

  if (!(await assinaturaValida(corpoCru, assinatura, segredo))) {
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

  // Anúncio fechado ou com erro antes do fim não credita nada (edge case do
  // core). O ticket segue não resgatado e expira sozinho.
  if (evento.status !== 'concluido') {
    return respostaJson({ creditado: false, motivo: 'ANUNCIO_NAO_CONCLUIDO' }, 200)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data, error } = await supabase.rpc('creditar_anuncio', {
    p_ticket_id: evento.ticketId,
  })

  if (error) {
    console.error('anuncio.credito_falhou', error.code, error.message)
    return respostaJson({ erro: 'FALHA_AO_CREDITAR' }, 500)
  }

  return respostaJson(data, 200)
})
