// Em que ordem a mochila mostra as peças.
//
// Nasceu para escolher quem representava uma PILHA: a lista agrupava por tipo e
// raridade, e "Arma comum ×9" era uma linha só. Isso acabou em 2026-08-13,
// quando a síntese saiu do inventário e ganhou painel próprio — a mochila
// passou a listar PEÇAS, uma por uma, cada uma com o nome dela
// (`nomeDoItem.ts`). Sem pilha, não há mais quem represente quem, e a pergunta
// que sobrou é a de ordem.
//
// A resposta continua a mesma de antes, com um critério a mais na frente:
// raridade. Ninguém abre a mochila procurando a pior peça, e uma lista que não
// puxa o melhor para cima obriga a percorrer tudo — numa lista paginada, isso
// vira "trocar de página até achar".

import type { ItemPossuido } from '../../lib/tipos'

/**
 * Ordena da melhor para a pior.
 *
 * Raridade primeiro porque é o eixo que o jogo inteiro usa para dizer "isto é
 * melhor"; fortificação depois, porque é o único eixo que o jogador constrói
 * com esforço (ouro e pedras); conjunto em seguida, porque só vale acompanhado
 * das outras peças; e o id no fim é só desempate estável — sem ele a lista
 * trocaria de ordem a cada render, e item que se mexe sozinho é item que se
 * clica errado.
 */
export function compararItens(a: ItemPossuido, b: ItemPossuido): number {
  if (a.raridade !== b.raridade) return b.raridade - a.raridade
  if (a.fortificacao !== b.fortificacao) return b.fortificacao - a.fortificacao
  const conjuntoA = a.conjuntoId ? 1 : 0
  const conjuntoB = b.conjuntoId ? 1 : 0
  if (conjuntoA !== conjuntoB) return conjuntoB - conjuntoA
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * As peças da mochila, na ordem em que aparecem.
 *
 * Cópia, e não `sort` no lugar: o array vem do snapshot, que é estado
 * compartilhado — ordenar por cima dele mexeria no que outras telas leem.
 */
export function ordenarParaMochila(itens: readonly ItemPossuido[]): ItemPossuido[] {
  return [...itens].sort(compararItens)
}
