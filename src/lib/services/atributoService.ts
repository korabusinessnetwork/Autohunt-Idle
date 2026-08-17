// Camada de serviço — atributos.
//
// Diferente das RPCs de farm, esta ACEITA parâmetros — e isso é legítimo: o
// jogador está escolhendo uma alocação, não declarando um ganho. O que o
// servidor confere é se o custo acumulado da alocação pedida cabe nos pontos
// que ele ganhou por level up. A validação daqui é conveniência de UI; a que
// vale é a do Postgres.

import { deErroSupabase, ok, type Envelope } from '../envelope'
import { obterSupabase } from '../supabaseClient'
import type { Atributos } from '../../game/regrasAtributos'
import type { Snapshot } from '../tipos'

export async function redistribuirAtributos(
  atributos: Atributos,
): Promise<Envelope<Snapshot>> {
  // Um parâmetro por atributo, escritos à mão: a RPC tem assinatura nomeada, e
  // espalhar `...atributos` aqui mandaria silenciosamente qualquer campo novo
  // do tipo — inclusive os que não são atributo — para dentro do Postgres.
  const { data, error } = await obterSupabase().rpc('redistribuir_atributos', {
    p_forca: atributos.forca,
    p_destreza: atributos.destreza,
    p_inteligencia: atributos.inteligencia,
    p_vitalidade: atributos.vitalidade,
    p_sorte: atributos.sorte,
  })
  if (error) return deErroSupabase<Snapshot>(error, 'ATRIBUTO_FALHOU')
  return ok(data as Snapshot)
}

// `reativarAutoAlocacao` morava aqui, e devolvia a distribuição ao servidor.
// Saiu junto com a auto-alocação em 2026-08-13; a RPC correspondente é
// derrubada em `supabase/migrations/20260829_atributos_manuais.sql`.
