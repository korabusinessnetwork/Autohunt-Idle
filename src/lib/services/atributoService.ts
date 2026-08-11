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
  const { data, error } = await obterSupabase().rpc('redistribuir_atributos', {
    p_forca: atributos.forca,
    p_inteligencia: atributos.inteligencia,
    p_vitalidade: atributos.vitalidade,
    p_sorte: atributos.sorte,
  })
  if (error) return deErroSupabase<Snapshot>(error, 'ATRIBUTO_FALHOU')
  return ok(data as Snapshot)
}

/**
 * Devolve a distribuição ao servidor.
 *
 * Sem parâmetro: o jogador está pedindo "cuida disso pra mim", não propondo uma
 * alocação. Como o respec é livre, alternar entre manual e automático não custa
 * nada e não pede confirmação.
 */
export async function reativarAutoAlocacao(): Promise<Envelope<Snapshot>> {
  const { data, error } = await obterSupabase().rpc('reativar_auto_alocacao', {})
  if (error) return deErroSupabase<Snapshot>(error, 'ATRIBUTO_FALHOU')
  return ok(data as Snapshot)
}
