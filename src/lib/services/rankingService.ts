// Camada de serviço — ranking global e apelido.
//
// O ranking é recomputado periodicamente dentro do Postgres, não a cada
// leitura (`specs/ranking-global.md`, critério 7) — então esta chamada é uma
// leitura barata de tabela pronta, não um cálculo.

import { deErroSupabase, ok, type Envelope } from '../envelope'
import { obterSupabase } from '../supabaseClient'
import type { RankingGlobal, Snapshot } from '../tipos'

/** Top 100 e a posição do próprio jogador, mesmo que ele esteja fora do top. */
export async function rankingGlobal(): Promise<Envelope<RankingGlobal>> {
  const { data, error } = await obterSupabase().rpc('ranking_global', {})
  if (error) return deErroSupabase<RankingGlobal>(error, 'RANKING_FALHOU')
  return ok(data as RankingGlobal)
}

/**
 * Define o apelido de exibição.
 *
 * É a porta de entrada do placar: sem apelido o jogador não aparece nele, e é
 * assim que o opt-in acontece — sem tela extra na primeira sessão, que o
 * critério 17 do core proíbe.
 */
export async function definirApelido(apelido: string): Promise<Envelope<Snapshot>> {
  const { data, error } = await obterSupabase().rpc('definir_apelido', {
    p_apelido: apelido,
  })
  if (error) return deErroSupabase<Snapshot>(error, 'APELIDO_FALHOU')
  return ok(data as Snapshot)
}
