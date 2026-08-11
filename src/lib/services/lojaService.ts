// Camada de serviço — loja de ouro.
//
// O client manda só o id do pacote. Quantidade, preço e saldo ficam todos do
// lado do servidor: a RPC lê o pacote da tabela `pacote_ouro`, trava a linha do
// jogador e debita/credita na mesma transação.
//
// O que este arquivo NÃO tem, e não é esquecimento: nenhuma função que converta
// diamante, ouro ou item em dinheiro. Não existe saque, resgate nem
// transferência entre jogadores — é restrição permanente
// (`memory/restrictions.md`), e é o que sustenta vender diamante como moeda de
// jogo.

import { deErroSupabase, ok, type Envelope } from '../envelope'
import { obterSupabase } from '../supabaseClient'
import type { Snapshot } from '../tipos'

/**
 * Troca diamante por ouro, em quantidade fixa e publicada.
 *
 * Recusa sem consumir nada quando falta diamante ou quando o pacote foi
 * desativado — inclusive se o client ainda o estiver exibindo em cache.
 */
export async function comprarOuro(pacoteId: string): Promise<Envelope<Snapshot>> {
  const { data, error } = await obterSupabase().rpc('comprar_ouro', {
    p_pacote: pacoteId,
  })
  if (error) return deErroSupabase<Snapshot>(error, 'COMPRA_FALHOU')
  return ok(data as Snapshot)
}
