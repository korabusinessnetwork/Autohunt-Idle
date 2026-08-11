// Edge Function — resgate de anúncio atestado pelo client.
//
// Existe porque os SDKs de anúncio recompensado da Poki e da CrazyGames são
// client-side e não oferecem callback servidor-a-servidor (ver ADR-004 e o
// cabeçalho de `supabase/migrations/20260812_resgate_anuncio_do_client.sql`).
//
// O que esta função garante, mesmo com a conclusão vindo do navegador:
//   · quem está pedindo é provado pelo JWT, não declarado no corpo;
//   · o ticket precisa existir, ser daquele jogador, estar dentro da validade
//     e nunca ter sido resgatado;
//   · os tetos (15 min por ticket, 2h/dia, saldo de 2h) são reaplicados no
//     banco a cada resgate.
//
// O corpo da requisição carrega UM campo: o id opaco do ticket. Não há como o
// client dizer quantos minutos quer — esse número está gravado no ticket que o
// servidor emitiu.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { respostaJson } from '../_shared/assinatura.ts'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return respostaJson({ erro: 'METODO_NAO_PERMITIDO' }, 405)
  }

  const autorizacao = req.headers.get('Authorization') ?? ''
  if (!autorizacao.startsWith('Bearer ')) {
    return respostaJson({ creditado: false, motivo: 'NAO_AUTENTICADO' }, 401)
  }

  let corpo: { ticketId?: unknown }
  try {
    corpo = await req.json()
  } catch {
    return respostaJson({ creditado: false, motivo: 'CORPO_INVALIDO' }, 400)
  }

  const ticketId = corpo?.ticketId
  if (typeof ticketId !== 'string' || ticketId.length === 0) {
    return respostaJson({ creditado: false, motivo: 'CORPO_INVALIDO' }, 400)
  }

  const url = Deno.env.get('SUPABASE_URL')!

  // Quem é o jogador é decidido pelo JWT, com a chave pública — nunca pelo que
  // o corpo da requisição afirma.
  const comoJogador = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: autorizacao } },
    auth: { persistSession: false },
  })

  const { data: usuario, error: erroUsuario } = await comoJogador.auth.getUser()
  if (erroUsuario || !usuario?.user) {
    return respostaJson({ creditado: false, motivo: 'NAO_AUTENTICADO' }, 401)
  }

  const comoServidor = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  const { data, error } = await comoServidor.rpc('resgatar_anuncio_do_jogador', {
    p_ticket_id: ticketId,
    p_player_id: usuario.user.id,
  })

  if (error) {
    console.error('anuncio.resgate_falhou', error.code, error.message)
    return respostaJson({ creditado: false, motivo: 'FALHA_AO_CREDITAR' }, 500)
  }

  return respostaJson(data, 200)
})
