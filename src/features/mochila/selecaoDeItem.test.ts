import { describe, expect, it } from 'vitest'

import type { ItemPossuido } from '../../lib/tipos'
import { compararItens, ordenarParaMochila } from './selecaoDeItem'

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
  it('põe a peça mais rara na frente, mesmo que ela seja menos fortificada', () => {
    // Raridade manda: uma comum +9 continua valendo menos que uma épica crua, e
    // a lista precisa dizer isso antes de o jogador abrir peça por peça.
    const comumFortificada = item({ id: 'a', raridade: 1, fortificacao: 9 })
    const epica = item({ id: 'b', raridade: 4, fortificacao: 0 })
    expect([comumFortificada, epica].sort(compararItens)[0]).toBe(epica)
  })

  it('na mesma raridade, põe a peça mais fortificada na frente', () => {
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
      item({ id: 'c', raridade: 9 }),
    ]
    const ids = (lista: ItemPossuido[]) => [...lista].sort(compararItens).map((i) => i.id)
    expect(ids(itens)).toEqual(ids([...itens].reverse()))
  })
})

describe('ordenarParaMochila', () => {
  const acervo = [
    item({ id: 'bota-comum', tipo: 'bota', raridade: 1 }),
    item({ id: 'espada-epica', tipo: 'arma', raridade: 4 }),
    item({ id: 'luva-cosmica', tipo: 'luva', raridade: 10 }),
    item({ id: 'espada-epica-forte', tipo: 'arma', raridade: 4, fortificacao: 3 }),
  ]

  it('devolve a lista da melhor peça para a pior', () => {
    expect(ordenarParaMochila(acervo).map((i) => i.id)).toEqual([
      'luva-cosmica',
      'espada-epica-forte',
      'espada-epica',
      'bota-comum',
    ])
  })

  it('não mexe no array que recebeu', () => {
    // O acervo vem do snapshot, que é estado compartilhado: ordenar por cima
    // dele mudaria o que outras telas leem.
    const copia = [...acervo]
    ordenarParaMochila(acervo)
    expect(acervo).toEqual(copia)
  })

  it('aguenta lista vazia', () => {
    expect(ordenarParaMochila([])).toEqual([])
  })
})
