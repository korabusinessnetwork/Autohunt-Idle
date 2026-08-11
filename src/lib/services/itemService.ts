// Camada de serviço — dungeon, síntese e skin.
//
// Nenhuma destas chamadas informa raridade recebida, quantidade de loot ou
// resultado: o servidor decide tudo e devolve pronto. Os parâmetros que
// existem são identificadores e escolhas do jogador — qual item equipar, qual
// pilha sintetizar —, nunca ganhos declarados.

import { deErroSupabase, ok, type Envelope } from '../envelope'
import { obterSupabase } from '../supabaseClient'
import type { Snapshot, TipoItem } from '../tipos'

/**
 * Roda uma dungeon.
 *
 * Sem parâmetro: qual chave é consumida e qual é o resultado são decisões do
 * servidor. Sem chave, ele recusa sem gastar nada.
 */
export async function iniciarDungeon(): Promise<Envelope<Snapshot>> {
  const { data, error } = await obterSupabase().rpc('iniciar_dungeon', {})
  if (error) return deErroSupabase<Snapshot>(error, 'DUNGEON_FALHOU')
  return ok(data as Snapshot)
}

/**
 * Combina 9 itens iguais em 1 do tier seguinte.
 *
 * O tipo e a raridade são a escolha de qual pilha combinar — o servidor
 * confere que existem mesmo 9 itens livres antes de consumir.
 */
export async function sintetizar(
  tipo: Exclude<TipoItem, 'chave'>,
  raridade: number,
): Promise<Envelope<Snapshot>> {
  const { data, error } = await obterSupabase().rpc('sintetizar', {
    p_tipo: tipo,
    p_raridade: raridade,
  })
  if (error) return deErroSupabase<Snapshot>(error, 'SINTESE_FALHOU')
  return ok(data as Snapshot)
}

/**
 * Equipa um item.
 *
 * O client manda só o id: o slot é derivado do tipo do item no servidor, que
 * também confere a posse. Trocar é livre — sem cooldown, sem custo, sem confirmação —, e
 * equipar uma skin não altera número nenhum do jogo: o cálculo de poder nem
 * olha para o slot de skin.
 */
export async function equiparItem(itemId: string): Promise<Envelope<Snapshot>> {
  const { data, error } = await obterSupabase().rpc('equipar_item', {
    p_item_id: itemId,
  })
  if (error) return deErroSupabase<Snapshot>(error, 'EQUIPAR_FALHOU')
  return ok(data as Snapshot)
}

/**
 * Fortifica um item equipável.
 *
 * Os parâmetros são escolhas do jogador — qual item, e se quer gastar as pedras
 * opcionais. A chance, o custo e o resultado são todos decididos pelo servidor:
 * o client nem sabe o número do sorteio.
 *
 * Falhar consome ouro e pedras e **não mexe no item** — não existe caminho no
 * SQL que reduza a fortificação.
 */
export async function fortificarItem(
  itemId: string,
  opcoes: { usarSorte?: boolean; usarGarantia?: boolean } = {},
): Promise<Envelope<Snapshot>> {
  const { data, error } = await obterSupabase().rpc('fortificar_item', {
    p_item_id: itemId,
    p_usar_sorte: opcoes.usarSorte ?? false,
    p_usar_garantia: opcoes.usarGarantia ?? false,
  })
  if (error) return deErroSupabase<Snapshot>(error, 'FORTIFICACAO_FALHOU')
  return ok(data as Snapshot)
}
