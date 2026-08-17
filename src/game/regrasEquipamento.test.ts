import { describe, expect, it } from 'vitest'

import type { TipoDano } from '../lib/tipos'
import { ATRIBUTOS as LISTA_DE_ATRIBUTOS, atributosZerados, type Atributos } from './regrasAtributos'
import {
  ATRIBUTO_DO_DANO,
  SLOTS_DE_PODER,
  calcularPoderDeAtaque,
  loadoutVazio,
  multiplicadorDeConjunto,
  pecasDoMaiorConjunto,
  poderDoItem,
  type ItemEquipado,
  type Loadout,
} from './regrasEquipamento'

// Sempre a partir de `atributosZerados()`, nunca de um literal escrito à mão: o
// sexto atributo, quando vier, custa uma linha aqui em vez de um erro de `tsc`
// espalhado por todo teste do projeto.
const ATRIBUTOS: Atributos = {
  ...atributosZerados(),
  forca: 20,
  destreza: 30,
  inteligencia: 10,
  vitalidade: 5,
  sorte: 5,
}

function arma(raridade: number, tipoDano: TipoDano, conjuntoId?: string): ItemEquipado {
  return { raridade, tipoDano, conjuntoId: conjuntoId ?? null }
}

function peca(raridade: number, afinidade?: TipoDano | null, conjuntoId?: string): ItemEquipado {
  return { raridade, afinidade: afinidade ?? null, conjuntoId: conjuntoId ?? null }
}

describe('slots por parte do corpo', () => {
  it('são seis, e nenhum deles é skin', () => {
    // A ausência de `skin` nesta lista é o que faz o cosmético ser cosmético:
    // não existe caminho por onde ela entre no cálculo de poder.
    expect(SLOTS_DE_PODER).toEqual(['arma', 'capacete', 'armadura', 'luva', 'bota', 'acessorio'])
    expect(SLOTS_DE_PODER).not.toContain('skin')
  })

  it('o loadout vazio não quebra o cálculo', () => {
    expect(() => calcularPoderDeAtaque(loadoutVazio(), atributosZerados())).not.toThrow()
    expect(calcularPoderDeAtaque(loadoutVazio(), ATRIBUTOS).arma).toBe(0)
  })

  it('slot vazio simplesmente não contribui', () => {
    const soArma: Loadout = { arma: arma(5, 'fisico') }
    const comCapacete: Loadout = { ...soArma, capacete: peca(5) }

    expect(calcularPoderDeAtaque(soArma, ATRIBUTOS).pecas).toBe(0)
    expect(calcularPoderDeAtaque(comCapacete, ATRIBUTOS).pecas).toBe(poderDoItem(5))
  })
})

describe('stat escala com a raridade', () => {
  it('cresce a cada tier e cresce mais que linear', () => {
    for (let tier = 1; tier < 10; tier++) {
      expect(poderDoItem(tier + 1)).toBeGreaterThan(poderDoItem(tier))
    }
    expect(poderDoItem(10) - poderDoItem(9)).toBeGreaterThan(poderDoItem(2) - poderDoItem(1))
  })

  it('não quebra em tier fora da faixa', () => {
    expect(poderDoItem(0)).toBe(0)
    expect(poderDoItem(-3)).toBe(0)
    expect(poderDoItem(999)).toBe(poderDoItem(10))
  })
})

describe('a arma escolhe o atributo — um conta inteiro, os outros contam zero', () => {
  // O pedido do dono, literal: "se ele usa cajado tem que dar dano mágico, logo
  // se ele upar força não pode aumentar o dano". Até 2026-08-14 o atributo do
  // outro canal entrava com metade do valor — e esses dois números (20 + 5 e
  // 10 + 10) eram exatamente o que os testes daqui mediam.

  it('o atributo do canal da arma conta INTEIRO, nos três canais', () => {
    expect(calcularPoderDeAtaque({ arma: arma(1, 'fisico') }, ATRIBUTOS).atributos).toBe(20)
    expect(calcularPoderDeAtaque({ arma: arma(1, 'destreza') }, ATRIBUTOS).atributos).toBe(30)
    expect(calcularPoderDeAtaque({ arma: arma(1, 'magico') }, ATRIBUTOS).atributos).toBe(10)
  })

  it('com cajado, 100 de Força somam ZERO', () => {
    const magica: Loadout = { arma: arma(1, 'magico') }
    const bruto = { ...atributosZerados(), inteligencia: 7 }
    const musculoso = { ...bruto, forca: 100 }

    expect(calcularPoderDeAtaque(magica, musculoso).atributos).toBe(7)
    expect(calcularPoderDeAtaque(magica, musculoso).total).toBe(
      calcularPoderDeAtaque(magica, bruto).total,
    )
  })

  it('com espada, 100 de Destreza somam ZERO', () => {
    const fisica: Loadout = { arma: arma(1, 'fisico') }
    const base = { ...atributosZerados(), forca: 7 }

    expect(calcularPoderDeAtaque(fisica, { ...base, destreza: 100 }).atributos).toBe(7)
  })

  it('com arma de destreza (arco, adaga), 100 de Inteligência somam ZERO', () => {
    const destra: Loadout = { arma: arma(1, 'destreza') }
    const base = { ...atributosZerados(), destreza: 7 }

    expect(calcularPoderDeAtaque(destra, { ...base, inteligencia: 100 }).atributos).toBe(7)
  })

  it('nenhum canal escapa: para cada um, só o próprio atributo move o poder', () => {
    // Exaustivo sobre a tabela, e não sobre uma lista escrita à mão: um quarto
    // canal entra em `ATRIBUTO_DO_DANO` já coberto por este teste.
    for (const [canal, atributo] of Object.entries(ATRIBUTO_DO_DANO) as [TipoDano, string][]) {
      const loadout: Loadout = { arma: arma(1, canal) }

      for (const outro of LISTA_DE_ATRIBUTOS) {
        const so = { ...atributosZerados(), [outro]: 50 } as Atributos
        const esperado = outro === atributo ? 50 : 0
        expect(calcularPoderDeAtaque(loadout, so).atributos, `${canal} × ${outro}`).toBe(esperado)
      }
    }
  })

  it('trocar de arma muda o quanto os atributos rendem', () => {
    // A consequência aceita: a mesma ficha de atributos vale coisas diferentes
    // conforme a arma na mão. É o que faz o respec existir.
    const fisica = calcularPoderDeAtaque({ arma: arma(1, 'fisico') }, ATRIBUTOS)
    const magica = calcularPoderDeAtaque({ arma: arma(1, 'magico') }, ATRIBUTOS)

    expect(fisica.total).toBeGreaterThan(magica.total)
  })

  it('sem arma equipada o herói é físico — e Força continua contando', () => {
    // O `?? 'fisico'` de `calcularPoderDeAtaque`, espelho do
    // `coalesce(v_arma.tipo_dano, 'fisico')` do Postgres. Sem ele, jogador novo
    // teria atributo nenhum entrando no poder nos primeiros cinco segundos.
    const semArma = calcularPoderDeAtaque(loadoutVazio(), ATRIBUTOS)
    const comEspada = calcularPoderDeAtaque({ arma: arma(1, 'fisico') }, ATRIBUTOS)

    expect(semArma.atributos).toBe(20)
    expect(semArma.atributos).toBe(comEspada.atributos)
    // E `{ arma: null }` é o mesmo caso que "slot ausente".
    expect(calcularPoderDeAtaque({ arma: null }, ATRIBUTOS).atributos).toBe(20)
  })

  it('vitalidade e sorte nunca entram no poder de ataque', () => {
    // Elas têm consumidor próprio (vida máxima e chance de raridade). Se um dia
    // vazarem para cá, o jogador upa Sorte e vê o dano subir sem explicação.
    const so = { ...atributosZerados(), vitalidade: 500, sorte: 500 }
    for (const canal of Object.keys(ATRIBUTO_DO_DANO) as TipoDano[]) {
      expect(calcularPoderDeAtaque({ arma: arma(1, canal) }, so).atributos, canal).toBe(0)
    }
  })
})

describe('sinergia de afinidade', () => {
  it('vale para qualquer peça, não só o acessório', () => {
    // Com seis slots, afinidade exclusiva do acessório faria cinco deles serem
    // só um número somado (decisão D2 do spec de build).
    const magica: Loadout = {
      arma: arma(5, 'magico'),
      capacete: peca(5, 'magico'),
      bota: peca(5, 'magico'),
    }
    expect(calcularPoderDeAtaque(magica, ATRIBUTOS).pecasEmSinergia).toBe(2)
  })

  it('peça com afinidade batendo rende mais que uma igual sem', () => {
    const combina: Loadout = { arma: arma(5, 'magico'), luva: peca(5, 'magico') }
    const naoCombina: Loadout = { arma: arma(5, 'magico'), luva: peca(5, 'fisico') }

    expect(calcularPoderDeAtaque(combina, ATRIBUTOS).pecas).toBeGreaterThan(
      calcularPoderDeAtaque(naoCombina, ATRIBUTOS).pecas,
    )
  })

  it('peça sem afinidade nenhuma contribui o stat normal', () => {
    const neutra: Loadout = { arma: arma(5, 'fisico'), armadura: peca(5, null) }
    expect(calcularPoderDeAtaque(neutra, ATRIBUTOS).pecas).toBe(poderDoItem(5))
    expect(calcularPoderDeAtaque(neutra, ATRIBUTOS).pecasEmSinergia).toBe(0)
  })
})

describe('conjunto em 2, 4 e 6 peças', () => {
  const CONJ = 'bruxa-caramelo'

  function conjuntoCom(quantidade: number): Loadout {
    const loadout: Loadout = {}
    SLOTS_DE_PODER.slice(0, quantidade).forEach((slot, i) => {
      loadout[slot] = i === 0 ? arma(6, 'magico', CONJ) : peca(6, 'magico', CONJ)
    })
    return loadout
  }

  it('cada degrau ativa no número certo de peças', () => {
    expect(multiplicadorDeConjunto(conjuntoCom(1))).toBe(1)
    expect(multiplicadorDeConjunto(conjuntoCom(2))).toBeGreaterThan(1)
    expect(multiplicadorDeConjunto(conjuntoCom(4))).toBeGreaterThan(
      multiplicadorDeConjunto(conjuntoCom(2)),
    )
    expect(multiplicadorDeConjunto(conjuntoCom(6))).toBeGreaterThan(
      multiplicadorDeConjunto(conjuntoCom(4)),
    )
  })

  it('cada degrau vale MAIS que o dobro do anterior', () => {
    // Generalização do critério 16 da spec de origem para seis slots: o
    // conjunto completo não pode ser só "duas vezes o degrau do meio".
    const bonus = (n: number) => multiplicadorDeConjunto(conjuntoCom(n)) - 1

    expect(bonus(4)).toBeGreaterThan(bonus(2) * 2)
    expect(bonus(6)).toBeGreaterThan(bonus(4) * 2)
  })

  it('bônus parcial não empilha entre conjuntos diferentes', () => {
    const misto: Loadout = {
      arma: arma(6, 'fisico', CONJ),
      capacete: peca(6, 'fisico', CONJ),
      armadura: peca(6, 'fisico', 'outro-conjunto'),
      luva: peca(6, 'fisico', 'outro-conjunto'),
    }
    // Dois de cada: o maior tem 2, e é só esse degrau que vale.
    expect(pecasDoMaiorConjunto(misto).pecas).toBe(2)
    expect(multiplicadorDeConjunto(misto)).toBe(multiplicadorDeConjunto(conjuntoCom(2)))
  })

  it('o bônus soma ao stat, nunca substitui', () => {
    const semConjunto: Loadout = {
      arma: arma(6, 'fisico'),
      capacete: peca(6, 'fisico'),
      armadura: peca(6, 'fisico'),
    }
    const comConjunto = conjuntoCom(3)

    const base = calcularPoderDeAtaque(semConjunto, ATRIBUTOS)
    const bonificado = calcularPoderDeAtaque(comConjunto, ATRIBUTOS)

    expect(bonificado.arma).toBe(base.arma)
    expect(bonificado.total).toBeGreaterThanOrEqual(base.total)
  })

  it('item sem conjunto não conta para nenhum', () => {
    const nenhum: Loadout = { arma: arma(6, 'fisico'), bota: peca(6, 'fisico') }
    expect(pecasDoMaiorConjunto(nenhum)).toEqual({ conjuntoId: null, pecas: 0 })
    expect(multiplicadorDeConjunto(nenhum)).toBe(1)
  })
})

describe('trocar de arma muda o resultado sozinho', () => {
  it('a mesma coleção rende diferente conforme a arma equipada', () => {
    const pecas = { capacete: peca(7, 'magico'), bota: peca(7, 'magico') }

    const comVarinha = calcularPoderDeAtaque({ arma: arma(7, 'magico'), ...pecas }, ATRIBUTOS)
    const comEspada = calcularPoderDeAtaque({ arma: arma(7, 'fisico'), ...pecas }, ATRIBUTOS)

    expect(comVarinha.pecasEmSinergia).toBe(2)
    expect(comEspada.pecasEmSinergia).toBe(0)
    expect(comVarinha.total).not.toBe(comEspada.total)
  })
})
