import { describe, expect, it } from 'vitest'

import {
  BONUS_PEDRA_SORTE,
  FORTIFICACAO_MAXIMA,
  PEDRAS,
  bonusDeFortificacao,
  chanceDeSucesso,
  custoEmOuro,
  resolverFortificacao,
  validarFortificacao,
  type PedidoFortificacao,
} from './regrasFortificacao'

const PEDIDO_BASE: PedidoFortificacao = {
  nivelAtual: 0,
  raridade: 5,
  ouroDisponivel: 1_000_000,
  pedrasFortificacao: 10,
  usarPedraSorte: false,
  pedrasSorte: 10,
  usarPedraGarantia: false,
  pedrasGarantia: 10,
}

describe('chance de sucesso', () => {
  it('nunca sobe conforme o nível cresce', () => {
    // Prova central: a dificuldade é monotônica. Se algum degrau ficasse mais
    // fácil que o anterior, "+15" deixaria de significar alguma coisa.
    for (let nivel = 0; nivel < FORTIFICACAO_MAXIMA; nivel++) {
      expect(chanceDeSucesso(nivel + 1)).toBeLessThanOrEqual(chanceDeSucesso(nivel))
    }
  })

  it('começa alta e chega ao piso', () => {
    expect(chanceDeSucesso(0)).toBeGreaterThan(0.9)
    expect(chanceDeSucesso(FORTIFICACAO_MAXIMA)).toBe(0.05)
  })

  it('nunca fica negativa nem passa do topo', () => {
    for (let nivel = 0; nivel <= 100; nivel++) {
      const chance = chanceDeSucesso(nivel, true)
      expect(chance).toBeGreaterThan(0)
      expect(chance).toBeLessThanOrEqual(0.95)
    }
  })

  it('a Pedra da Sorte melhora a tentativa', () => {
    expect(chanceDeSucesso(8, true)).toBeCloseTo(chanceDeSucesso(8) + BONUS_PEDRA_SORTE, 5)
  })
})

describe('custo em ouro', () => {
  it('cresce com o nível e com a raridade', () => {
    expect(custoEmOuro(1, 5)).toBeGreaterThan(custoEmOuro(0, 5))
    expect(custoEmOuro(0, 10)).toBeGreaterThan(custoEmOuro(0, 1))
  })

  it('é sempre inteiro e positivo', () => {
    for (const nivel of [0, 3, 10, 15]) {
      const custo = custoEmOuro(nivel, 7)
      expect(Number.isInteger(custo)).toBe(true)
      expect(custo).toBeGreaterThan(0)
    }
  })
})

describe('bônus no stat', () => {
  it('cresce a cada nível e é neutro em +0', () => {
    expect(bonusDeFortificacao(0)).toBe(1)
    expect(bonusDeFortificacao(5)).toBeGreaterThan(bonusDeFortificacao(4))
  })

  it('não passa do teto nem com valor absurdo', () => {
    expect(bonusDeFortificacao(999)).toBe(bonusDeFortificacao(FORTIFICACAO_MAXIMA))
  })
})

describe('falhar não custa progresso', () => {
  it('mantém o item exatamente no nível em que estava', () => {
    // A prova central do critério 7, e do princípio "progresso nunca é punido":
    // no pior caso o jogador perdeu ouro e pedra, nunca nível.
    for (const nivel of [0, 1, 7, 14, FORTIFICACAO_MAXIMA]) {
      const falhou = resolverFortificacao(nivel, 0.5, 0.99)
      expect(falhou.sucesso).toBe(false)
      expect(falhou.nivelFinal).toBe(nivel)
    }
  })

  it('sucesso sobe exatamente um degrau', () => {
    expect(resolverFortificacao(3, 0.5, 0.1)).toEqual({ sucesso: true, nivelFinal: 4 })
  })

  it('sucesso no teto não ultrapassa', () => {
    expect(resolverFortificacao(FORTIFICACAO_MAXIMA, 1, 0).nivelFinal).toBe(FORTIFICACAO_MAXIMA)
  })
})

describe('validação recusa antes de consumir', () => {
  it('aceita o caso normal', () => {
    const resultado = validarFortificacao(PEDIDO_BASE)
    expect(resultado.ok).toBe(true)
  })

  it('recusa no teto', () => {
    expect(
      validarFortificacao({ ...PEDIDO_BASE, nivelAtual: FORTIFICACAO_MAXIMA }),
    ).toEqual({ ok: false, erro: 'TETO_ATINGIDO' })
  })

  it('recusa sem pedra de fortificação', () => {
    expect(validarFortificacao({ ...PEDIDO_BASE, pedrasFortificacao: 0 })).toEqual({
      ok: false,
      erro: 'SEM_PEDRA',
    })
  })

  it('recusa sem ouro — e antes de olhar qualquer outra coisa que consuma', () => {
    expect(validarFortificacao({ ...PEDIDO_BASE, ouroDisponivel: 0 })).toEqual({
      ok: false,
      erro: 'OURO_INSUFICIENTE',
    })
  })

  it('recusa quando pede uma pedra que não tem', () => {
    expect(
      validarFortificacao({ ...PEDIDO_BASE, usarPedraSorte: true, pedrasSorte: 0 }),
    ).toEqual({ ok: false, erro: 'SEM_PEDRA' })
    expect(
      validarFortificacao({ ...PEDIDO_BASE, usarPedraGarantia: true, pedrasGarantia: 0 }),
    ).toEqual({ ok: false, erro: 'SEM_PEDRA' })
  })

  it('a Pedra de Garantia torna a tentativa certa', () => {
    const resultado = validarFortificacao({ ...PEDIDO_BASE, nivelAtual: 14, usarPedraGarantia: true })
    expect(resultado.ok && resultado.chance).toBe(1)
  })
})

describe('as pedras', () => {
  it('são exatamente três, e todas são loot', () => {
    expect(PEDRAS).toEqual(['pedra_fortificacao', 'pedra_sorte', 'pedra_garantia'])
  })
})
