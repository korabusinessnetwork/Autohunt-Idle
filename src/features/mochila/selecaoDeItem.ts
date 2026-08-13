// Qual peça a mochila representa quando mostra uma PILHA.
//
// A lista de itens agrupa por tipo e raridade — "Espada épica ×3" é uma linha
// só, senão o inventário vira uma parede de linhas iguais. Mas equipar e ver
// atributos agem sobre UMA peça, e três espadas épicas podem ser diferentes
// entre si (fortificação, conjunto, afinidade).
//
// A regra: a pilha responde pela MELHOR peça dela. Ninguém abre a mochila
// querendo vestir a pior cópia — e mostrar o número da pior seria mentir sobre
// o que a pilha vale.

import type { ItemPossuido, TipoItem } from '../../lib/tipos'

/**
 * Ordena da melhor para a pior.
 *
 * Fortificação primeiro porque é o único eixo que o jogador constrói com
 * esforço (ouro e pedras); conjunto depois porque só vale acompanhado das
 * outras peças; o id no fim é só desempate estável — sem ele a lista trocaria
 * de ordem a cada render, e item que se mexe sozinho é item que se clica
 * errado.
 */
export function compararItens(a: ItemPossuido, b: ItemPossuido): number {
  if (a.fortificacao !== b.fortificacao) return b.fortificacao - a.fortificacao
  const conjuntoA = a.conjuntoId ? 1 : 0
  const conjuntoB = b.conjuntoId ? 1 : 0
  if (conjuntoA !== conjuntoB) return conjuntoB - conjuntoA
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * A peça que representa a pilha de um tipo e raridade — ou `null` quando não há
 * nenhuma equipável ali (chaves e pedras caem neste caso, e é por isso que elas
 * não ganham botão de equipar).
 */
export function melhorDoGrupo(
  itens: readonly ItemPossuido[],
  tipo: TipoItem,
  raridade: number,
): ItemPossuido | null {
  const candidatos = itens.filter((item) => item.tipo === tipo && item.raridade === raridade)
  if (candidatos.length === 0) return null
  return [...candidatos].sort(compararItens)[0] ?? null
}
