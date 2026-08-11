import { describe, expect, it } from 'vitest'

import { atributosZerados, type Atributos } from './regrasAtributos'
import {
  calcularPoderDeAtaque,
  loadoutVazio,
  multiplicadorDeConjunto,
  pecasDoMaiorConjunto,
  poderDoItem,
  type ItemEquipado,
  type Loadout,
} from './regrasEquipamento'

const ATRIBUTOS: Atributos = { forca: 20, inteligencia: 10, vitalidade: 5, sorte: 5 }

function arma(raridade: number, tipoDano: 'fisico' | 'magico', conjuntoId?: string): ItemEquipado {
  return { raridade, tipoDano, conjuntoId: conjuntoId ?? null }
}

function acessorio(
  raridade: number,
  afinidade?: 'fisico' | 'magico' | null,
  conjuntoId?: string,
): ItemEquipado {
  return { raridade, afinidade: afinidade ?? null, conjuntoId: conjuntoId ?? null }
}

describe('stat escala com a raridade', () => {
  it('cresce a cada tier e cresce mais que linear', () => {
    for (let tier = 1; tier < 10; tier++) {
      expect(poderDoItem(tier + 1)).toBeGreaterThan(poderDoItem(tier))
    }
    // Cósmico precisa parecer cósmico: o salto do topo é maior que o da base.
    expect(poderDoItem(10) - poderDoItem(9)).toBeGreaterThan(poderDoItem(2) - poderDoItem(1))
  })

  it('não quebra em tier fora da faixa', () => {
    expect(poderDoItem(0)).toBe(0)
    expect(poderDoItem(-3)).toBe(0)
    expect(poderDoItem(999)).toBe(poderDoItem(10))
  })
})

describe('skin não entra no cálculo de poder', () => {
  it('o loadout nem tem onde colocar uma', () => {
    // Prova estrutural do critério 7: `Loadout` só tem arma e dois acessórios.
    // Não existe caminho por onde uma skin influencie o poder.
    const chaves = Object.keys(loadoutVazio())
    expect(chaves.sort()).toEqual(['acessorio1', 'acessorio2', 'arma'])
    expect(chaves).not.toContain('skin')
  })
})

describe('atributo pondera pelo tipo de dano da arma', () => {
  it('Força conta inteiro com arma física, Inteligência pela metade', () => {
    const fisica: Loadout = { arma: arma(1, 'fisico'), acessorio1: null, acessorio2: null }
    const detalhe = calcularPoderDeAtaque(fisica, ATRIBUTOS)

    // 20 de Força inteiro + metade dos 10 de Inteligência.
    expect(detalhe.atributos).toBe(20 + 5)
  })

  it('a mesma build rende menos com arma mágica', () => {
    const fisica: Loadout = { arma: arma(1, 'fisico'), acessorio1: null, acessorio2: null }
    const magica: Loadout = { arma: arma(1, 'magico'), acessorio1: null, acessorio2: null }

    // Build de Força com varinha: 10 de Inteligência inteiro + metade dos 20.
    expect(calcularPoderDeAtaque(magica, ATRIBUTOS).atributos).toBe(10 + 10)
    expect(calcularPoderDeAtaque(fisica, ATRIBUTOS).total).toBeGreaterThan(
      calcularPoderDeAtaque(magica, ATRIBUTOS).total,
    )
  })

  it('sem arma equipada, assume físico e não quebra', () => {
    expect(() => calcularPoderDeAtaque(loadoutVazio(), atributosZerados())).not.toThrow()
    expect(calcularPoderDeAtaque(loadoutVazio(), ATRIBUTOS).arma).toBe(0)
  })
})

describe('sinergia de afinidade', () => {
  it('acessório com afinidade batendo rende mais que um igual sem afinidade', () => {
    const comSinergia: Loadout = {
      arma: arma(5, 'magico'),
      acessorio1: acessorio(5, 'magico'),
      acessorio2: null,
    }
    const semSinergia: Loadout = {
      arma: arma(5, 'magico'),
      acessorio1: acessorio(5, 'fisico'),
      acessorio2: null,
    }

    expect(calcularPoderDeAtaque(comSinergia, ATRIBUTOS).acessorios).toBeGreaterThan(
      calcularPoderDeAtaque(semSinergia, ATRIBUTOS).acessorios,
    )
    expect(calcularPoderDeAtaque(comSinergia, ATRIBUTOS).acessoriosEmSinergia).toBe(1)
  })

  it('acessório sem afinidade nenhuma contribui o stat normal', () => {
    const neutro: Loadout = {
      arma: arma(5, 'fisico'),
      acessorio1: acessorio(5, null),
      acessorio2: null,
    }
    expect(calcularPoderDeAtaque(neutro, ATRIBUTOS).acessorios).toBe(poderDoItem(5))
    expect(calcularPoderDeAtaque(neutro, ATRIBUTOS).acessoriosEmSinergia).toBe(0)
  })

  it('slot de acessório vazio simplesmente não contribui', () => {
    const umSo: Loadout = {
      arma: arma(4, 'fisico'),
      acessorio1: acessorio(4, 'fisico'),
      acessorio2: null,
    }
    expect(calcularPoderDeAtaque(umSo, ATRIBUTOS).acessoriosEmSinergia).toBe(1)
  })
})

describe('conjunto', () => {
  const CONJ = 'bruxa-caramelo'

  it('2 peças ativam o bônus de 2', () => {
    const duas: Loadout = {
      arma: arma(6, 'magico', CONJ),
      acessorio1: acessorio(6, 'magico', CONJ),
      acessorio2: null,
    }
    expect(pecasDoMaiorConjunto(duas).pecas).toBe(2)
    expect(multiplicadorDeConjunto(duas)).toBeGreaterThan(1)
  })

  it('3 peças valem MAIS que a soma dos parciais', () => {
    // Prova central do critério 14: o conjunto completo não pode ser só "duas
    // vezes o bônus de duas peças".
    const duas: Loadout = {
      arma: arma(6, 'magico', CONJ),
      acessorio1: acessorio(6, 'magico', CONJ),
      acessorio2: null,
    }
    const tres: Loadout = { ...duas, acessorio2: acessorio(6, 'magico', CONJ) }

    const bonusDeDuas = multiplicadorDeConjunto(duas) - 1
    const bonusDeTres = multiplicadorDeConjunto(tres) - 1

    expect(bonusDeTres).toBeGreaterThan(bonusDeDuas * 2)
  })

  it('bônus parcial não empilha entre conjuntos diferentes', () => {
    // Critério 16: 2 de um e 1 de outro ativa só o bônus de 2 do primeiro.
    const misto: Loadout = {
      arma: arma(6, 'fisico', CONJ),
      acessorio1: acessorio(6, 'fisico', CONJ),
      acessorio2: acessorio(6, 'fisico', 'outro-conjunto'),
    }
    const soDuas: Loadout = {
      arma: arma(6, 'fisico', CONJ),
      acessorio1: acessorio(6, 'fisico', CONJ),
      acessorio2: acessorio(6, 'fisico'),
    }

    expect(pecasDoMaiorConjunto(misto).pecas).toBe(2)
    expect(multiplicadorDeConjunto(misto)).toBe(multiplicadorDeConjunto(soDuas))
  })

  it('o bônus soma ao stat, nunca substitui', () => {
    // Critério 15: o conjunto multiplica um total que já inclui o stat dos
    // itens — ele nunca troca o stat por um número fixo.
    const semConjunto: Loadout = {
      arma: arma(6, 'fisico'),
      acessorio1: acessorio(6, 'fisico'),
      acessorio2: acessorio(6, 'fisico'),
    }
    const comConjunto: Loadout = {
      arma: arma(6, 'fisico', CONJ),
      acessorio1: acessorio(6, 'fisico', CONJ),
      acessorio2: acessorio(6, 'fisico', CONJ),
    }

    const base = calcularPoderDeAtaque(semConjunto, ATRIBUTOS)
    const bonificado = calcularPoderDeAtaque(comConjunto, ATRIBUTOS)

    expect(bonificado.arma).toBe(base.arma)
    expect(bonificado.acessorios).toBe(base.acessorios)
    expect(bonificado.total).toBeGreaterThan(base.total)
  })

  it('item sem conjunto não conta para nenhum', () => {
    const nenhum: Loadout = {
      arma: arma(6, 'fisico'),
      acessorio1: acessorio(6, 'fisico'),
      acessorio2: acessorio(6, 'fisico'),
    }
    expect(pecasDoMaiorConjunto(nenhum)).toEqual({ conjuntoId: null, pecas: 0 })
    expect(multiplicadorDeConjunto(nenhum)).toBe(1)
  })
})

describe('trocar de arma muda o resultado sozinho', () => {
  it('a mesma coleção rende diferente conforme a arma equipada', () => {
    // Critério 7 da spec de origem: a "classe" emerge do loadout e muda no
    // instante em que a arma muda — sem confirmação, sem cooldown, sem custo.
    const acessorios = {
      acessorio1: acessorio(7, 'magico'),
      acessorio2: acessorio(7, 'magico'),
    }

    const comVarinha = calcularPoderDeAtaque({ arma: arma(7, 'magico'), ...acessorios }, ATRIBUTOS)
    const comEspada = calcularPoderDeAtaque({ arma: arma(7, 'fisico'), ...acessorios }, ATRIBUTOS)

    expect(comVarinha.acessoriosEmSinergia).toBe(2)
    expect(comEspada.acessoriosEmSinergia).toBe(0)
    expect(comVarinha.total).not.toBe(comEspada.total)
  })
})
