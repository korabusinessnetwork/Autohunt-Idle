// Camada de serviço — dungeon, síntese e skin.
//
// Nenhuma destas chamadas informa raridade recebida, quantidade de loot ou
// resultado: o servidor decide tudo e devolve pronto. Os parâmetros que
// existem são identificadores e escolhas do jogador — qual item equipar, qual
// pilha sintetizar —, nunca ganhos declarados.

import { deErroSupabase, ok, type Envelope } from '../envelope'
import { obterSupabase } from '../supabaseClient'
import type { SlotEquipamento, Snapshot, TipoItem } from '../tipos'

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
 * Equipa um item num slot.
 *
 * O client manda um id e um slot; quem confere posse e se o tipo cabe ali é o
 * servidor. Trocar é livre — sem cooldown, sem custo, sem confirmação —, e
 * equipar uma skin não altera número nenhum do jogo: o cálculo de poder nem
 * olha para o slot de skin.
 */
export async function equiparItem(
  itemId: string,
  slot: SlotEquipamento,
): Promise<Envelope<Snapshot>> {
  const { data, error } = await obterSupabase().rpc('equipar_item', {
    p_item_id: itemId,
    p_slot: slot,
  })
  if (error) return deErroSupabase<Snapshot>(error, 'EQUIPAR_FALHOU')
  return ok(data as Snapshot)
}
