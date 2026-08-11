import { describe, expect, it } from 'vitest'

import {
  CHANCE_DE_PULAR_NIVEL,
  FAIXA_BOSS,
  FAIXA_DUNGEON_PERDIDA,
  FAIXA_MINI_BOSS,
  FAIXA_MUNDO,
  ITENS_POR_SINTESE,
  RARIDADES,
  TIER_MAXIMO,
  chanceDeSubir,
  escalarRaridade,
  nomeDaRaridade,
  resolverSintese,
} from './regrasLoot'

/** Sorteios que sempre passam / sempre falham, para isolar a lógica do acaso. */
const SEMPRE_SOBE = Array(20).fill(0)
const NUNCA_SOBE = Array(20).fill(1)

describe('tiers de raridade', () => {
  it('tem exatamente 10, na ordem da spec', () => {
    expect(RARIDADES).toHaveLength(10)
    expect(RARIDADES[0]).toBe('comum')
    expect(RARIDADES[TIER_MAXIMO - 1]).toBe('cosmico')
  })

  it('mapeia tier para nome sem estourar as bordas', () => {
    expect(nomeDaRaridade(1)).toBe('comum')
    expect(nomeDaRaridade(10)).toBe('cosmico')
    expect(nomeDaRaridade(0)).toBe('comum')
    expect(nomeDaRaridade(99)).toBe('cosmico')
  })
})

describe('piso de raridade é garantia, não sorteio', () => {
  it('o boss de dungeon nunca rende abaixo de raro, nem na pior sorte', () => {
    // Prova central do critério 11: "mínimo raro, certeza, não só chance".
    expect(escalarRaridade(FAIXA_BOSS, 0, NUNCA_SOBE)).toBe(3)
    expect(escalarRaridade(FAIXA_BOSS, 0, [])).toBe(3)
  })

  it('o mini boss fica entre incomum e raro, nos dois extremos de sorteio', () => {
    expect(escalarRaridade(FAIXA_MINI_BOSS, 0, NUNCA_SOBE)).toBe(2)
    expect(escalarRaridade(FAIXA_MINI_BOSS, 9999, SEMPRE_SOBE)).toBe(3)
  })

  it('a dungeon perdida rende sem piso garantido', () => {
    // A chave foi gasta — o edge case da spec diz que isso é por design —, mas
    // o loot continua existindo, só sem a garantia.
    expect(escalarRaridade(FAIXA_DUNGEON_PERDIDA, 0, NUNCA_SOBE)).toBe(1)
    expect(escalarRaridade(FAIXA_DUNGEON_PERDIDA, 0, SEMPRE_SOBE)).toBe(3)
  })

  it('o mundo aberto começa em comum e pode chegar ao topo', () => {
    expect(escalarRaridade(FAIXA_MUNDO, 0, NUNCA_SOBE)).toBe(1)
    expect(escalarRaridade(FAIXA_MUNDO, 0, SEMPRE_SOBE)).toBe(TIER_MAXIMO)
  })

  it('nunca ultrapassa o tier máximo do jogo', () => {
    expect(escalarRaridade({ piso: 9, teto: 50 }, 9999, SEMPRE_SOBE)).toBe(TIER_MAXIMO)
  })

  it('para no primeiro sorteio ruim', () => {
    const chance = chanceDeSubir(0)
    // Dois sucessos e um fracasso: sobe dois degraus e para.
    expect(escalarRaridade(FAIXA_MUNDO, 0, [0, 0, 1, 0, 0])).toBe(3)
    expect(chance).toBeGreaterThan(0)
  })
})

describe('Sorte', () => {
  it('aumenta a chance de subir de tier', () => {
    expect(chanceDeSubir(400)).toBeGreaterThan(chanceDeSubir(0))
  })

  it('tem teto — investir muito ajuda, mas não torna tier alto trivial', () => {
    const enorme = chanceDeSubir(1_000_000)
    expect(enorme).toBeLessThanOrEqual(chanceDeSubir(0) + 0.12 + 1e-9)
    expect(enorme).toBeLessThan(0.5)
  })

  it('não quebra com Sorte negativa', () => {
    expect(chanceDeSubir(-50)).toBe(chanceDeSubir(0))
  })
})

describe('síntese', () => {
  it('conserva a conta: 9 entram, 1 sai', () => {
    // Prova central do critério 20: nunca some item sem gerar, nem gera sem
    // consumir.
    const resultado = resolverSintese(3, 9, 0.5)

    expect(resultado).toEqual({ ok: true, consome: ITENS_POR_SINTESE, produzRaridade: 4 })
  })

  it('pula um nível quando o sorteio ajuda', () => {
    const pulou = resolverSintese(3, 9, CHANCE_DE_PULAR_NIVEL - 0.001)
    expect(pulou).toEqual({ ok: true, consome: 9, produzRaridade: 5 })
  })

  it('o pulo nunca ultrapassa o topo', () => {
    const noPenultimo = resolverSintese(9, 9, 0)
    expect(noPenultimo).toEqual({ ok: true, consome: 9, produzRaridade: TIER_MAXIMO })
  })

  it('recusa com menos de 9 itens', () => {
    expect(resolverSintese(3, 8, 0.5)).toEqual({ ok: false, erro: 'ITENS_INSUFICIENTES' })
  })

  it('recusa no tier máximo', () => {
    expect(resolverSintese(TIER_MAXIMO, 90, 0.5)).toEqual({ ok: false, erro: 'TIER_MAXIMO' })
  })

  it('sobe exatamente um tier na esmagadora maioria das vezes', () => {
    // 8% de chance de pular é "pequena" (critério 17), não a regra.
    expect(CHANCE_DE_PULAR_NIVEL).toBeLessThan(0.15)
    expect(CHANCE_DE_PULAR_NIVEL).toBeGreaterThan(0)
  })
})
