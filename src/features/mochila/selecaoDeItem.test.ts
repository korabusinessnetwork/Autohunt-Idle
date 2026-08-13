import { describe, expect, it } from 'vitest'

import type { ItemPossuido } from '../../lib/tipos'
import { compararItens, melhorDoGrupo } from './selecaoDeItem'

function item(parcial: Partial<ItemPossuido> & { id: string }): ItemPossuido {
  return {
    tipo: 'arma',
    raridade: 4,
    fortificacao: 0,
    slot: null,
    tipoDano: 'fisico',
    afinidade: null,
    conjuntoId: null,
    ...parcial,
  }
}

describe('compararItens', () => {
  it('põe a peça mais fortificada na frente', () => {
    const fraca = item({ id: 'a', fortificacao: 1 })
    const forte = item({ id: 'b', fortificacao: 7 })
    expect([fraca, forte].sort(compararItens)[0]).toBe(forte)
  })

  it('com a mesma fortificação, prefere a que pertence a um conjunto', () => {
    const solta = item({ id: 'a' })
    const deConjunto = item({ id: 'b', conjuntoId: 'bruxa-caramelo' })
    expect([solta, deConjunto].sort(compararItens)[0]).toBe(deConjunto)
  })

  it('desempata pelo id, para a lista não trocar de ordem sozinha', () => {
    const primeiro = item({ id: 'aaa' })
    const segundo = item({ id: 'bbb' })
    expect([segundo, primeiro].sort(compararItens)[0]).toBe(primeiro)
    expect([primeiro, segundo].sort(compararItens)[0]).toBe(primeiro)
  })

  it('não depende da ordem de entrada', () => {
    const itens = [
      item({ id: 'a', fortificacao: 3 }),
      item({ id: 'b', fortificacao: 3, conjuntoId: 'x' }),
      item({ id: 'c', fortificacao: 9 }),
    ]
    const ids = (lista: ItemPossuido[]) => [...lista].sort(compararItens).map((i) => i.id)
    expect(ids(itens)).toEqual(ids([...itens].reverse()))
  })
})

describe('melhorDoGrupo', () => {
  const acervo = [
    item({ id: 'espada-fraca', tipo: 'arma', raridade: 4, fortificacao: 0 }),
    item({ id: 'espada-forte', tipo: 'arma', raridade: 4, fortificacao: 5 }),
    item({ id: 'espada-comum', tipo: 'arma', raridade: 1, fortificacao: 9 }),
    item({ id: 'bota', tipo: 'bota', raridade: 4, fortificacao: 2 }),
  ]

  it('devolve a melhor peça do tipo e da raridade pedidos', () => {
    expect(melhorDoGrupo(acervo, 'arma', 4)?.id).toBe('espada-forte')
  })

  it('não atravessa raridade: cada tier é uma pilha própria', () => {
    expect(melhorDoGrupo(acervo, 'arma', 1)?.id).toBe('espada-comum')
  })

  it('devolve null quando nada equipável responde pela pilha', () => {
    // É o caso das chaves e das três pedras: elas aparecem na lista de itens
    // mas nunca ganham botão de equipar.
    expect(melhorDoGrupo(acervo, 'chave', 1)).toBeNull()
    expect(melhorDoGrupo(acervo, 'arma', 10)).toBeNull()
    expect(melhorDoGrupo([], 'arma', 4)).toBeNull()
  })

  it('não altera o acervo recebido', () => {
    const copia = [...acervo]
    melhorDoGrupo(acervo, 'arma', 4)
    expect(acervo).toEqual(copia)
  })
})
