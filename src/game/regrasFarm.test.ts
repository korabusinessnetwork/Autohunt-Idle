import { describe, expect, it } from 'vitest'

import {
  TETO_ANUNCIO_DIARIO_MIN,
  TETO_ASSINANTE_MIN,
  nivelPorXp,
  resolverCiclos,
  tetoOfflineMinutos,
  vitalidadeMaxima,
  xpAcumuladoParaNivel,
} from './regrasFarm'

describe('curva de XP', () => {
  it('exige XP crescente a cada nível', () => {
    const custos = [1, 2, 3, 4, 5].map(
      (n) => xpAcumuladoParaNivel(n + 1) - xpAcumuladoParaNivel(n),
    )
    for (let i = 1; i < custos.length; i++) {
      expect(custos[i]!).toBeGreaterThan(custos[i - 1]!)
    }
  })

  it('converte XP em nível nas bordas exatas', () => {
    expect(nivelPorXp(0)).toBe(1)
    expect(nivelPorXp(99)).toBe(1)
    expect(nivelPorXp(100)).toBe(2)
    expect(nivelPorXp(299)).toBe(2)
    expect(nivelPorXp(300)).toBe(3)
  })

  it('não tem teto de nível (core, 12)', () => {
    // Se existisse um NIVEL_MAXIMO escondido, este valor bateria no limite.
    expect(nivelPorXp(xpAcumuladoParaNivel(100_000))).toBe(100_000)
    expect(nivelPorXp(xpAcumuladoParaNivel(1_000_000))).toBe(1_000_000)
  })

  it('é consistente com a inversa em qualquer nível amostrado', () => {
    for (const nivel of [1, 2, 7, 50, 999, 12_345]) {
      expect(nivelPorXp(xpAcumuladoParaNivel(nivel))).toBe(nivel)
      expect(nivelPorXp(xpAcumuladoParaNivel(nivel) - 1)).toBe(nivel - 1 || 1)
    }
  })
})

describe('resolução de ciclos', () => {
  it('rende o esperado quando ninguém cai', () => {
    const resultado = resolverCiclos(1, vitalidadeMaxima(1), 10, 1)

    expect(resultado.xp).toBe(150) // 10 ciclos * 3 abates * 5 XP
    expect(resultado.moeda).toBe(60) // 10 ciclos * 3 abates * 2 moedas
    expect(resultado.ciclosPerdidos).toBe(0)
    expect(resultado.vitalidade).toBe(20) // 110 - 10 * 9
  })

  it('perde SÓ o ciclo em que a Vitalidade zera (core, 16)', () => {
    const resultado = resolverCiclos(1, vitalidadeMaxima(1), 13, 1)

    expect(resultado.ciclosPerdidos).toBe(1)
    // Os 12 ciclos anteriores continuam valendo: nada já conquistado é multado.
    expect(resultado.xp).toBe(180)
    expect(resultado.moeda).toBe(72)
    // E o personagem volta inteiro, pronto pra farmar no ciclo seguinte.
    expect(resultado.vitalidade).toBe(vitalidadeMaxima(1))
  })

  it('aplica o 2x do assinante só no XP, nunca na moeda (core, 4a)', () => {
    const semAssinatura = resolverCiclos(1, vitalidadeMaxima(1), 10, 1)
    const comAssinatura = resolverCiclos(1, vitalidadeMaxima(1), 10, 2)

    expect(comAssinatura.xp).toBe(semAssinatura.xp * 2)
    expect(comAssinatura.moeda).toBe(semAssinatura.moeda)
  })

  it('não rende nada com zero ciclo', () => {
    const resultado = resolverCiclos(5, vitalidadeMaxima(5), 0, 2)
    expect(resultado).toMatchObject({ xp: 0, moeda: 0, ciclosPerdidos: 0 })
  })

  it('mantém a frequência de derrota estável conforme o nível cresce', () => {
    // Vitalidade e dano escalam juntos: subir de nível não pode tornar o farm
    // mais punitivo do que era no começo.
    const baixo = resolverCiclos(1, vitalidadeMaxima(1), 240, 1).ciclosPerdidos
    const alto = resolverCiclos(500, vitalidadeMaxima(500), 240, 1).ciclosPerdidos

    expect(Math.abs(alto - baixo)).toBeLessThanOrEqual(5)
  })
})

describe('efeito dos atributos no farm (specs/ranking-global.md, critério 8)', () => {
  const zerados = { forca: 0, inteligencia: 0, vitalidade: 0, sorte: 0 }

  it('Vitalidade aumenta a Vitalidade máxima', () => {
    expect(vitalidadeMaxima(1, 0)).toBe(110)
    expect(vitalidadeMaxima(1, 4)).toBe(210)
  })

  it('Vitalidade reduz quantos ciclos são perdidos por derrota', () => {
    const semVitalidade = resolverCiclos(1, vitalidadeMaxima(1, 0), 240, 1, zerados)
    const comVitalidade = resolverCiclos(1, vitalidadeMaxima(1, 20), 240, 1, {
      ...zerados,
      vitalidade: 20,
    })

    expect(comVitalidade.ciclosPerdidos).toBeLessThan(semVitalidade.ciclosPerdidos)
  })

  it('Força e Inteligência aumentam o rendimento por ciclo', () => {
    const semAtaque = resolverCiclos(1, vitalidadeMaxima(1, 0), 10, 1, zerados)
    const comAtaque = resolverCiclos(1, vitalidadeMaxima(1, 0), 10, 1, {
      ...zerados,
      forca: 16,
      inteligencia: 16,
    })

    expect(comAtaque.xp).toBeGreaterThan(semAtaque.xp)
    expect(comAtaque.moeda).toBeGreaterThan(semAtaque.moeda)
  })

  it('sem arma equipada, Força pesa mais que Inteligência', () => {
    // A separação chegou com `specs/equipamento-e-poder.md`: o atributo que
    // casa com o tipo de dano conta inteiro, o outro conta pela metade. Sem
    // arma, o tipo padrão é físico — então Força é o principal.
    const soForca = resolverCiclos(1, vitalidadeMaxima(1, 0), 10, 1, { ...zerados, forca: 16 })
    const soInteligencia = resolverCiclos(1, vitalidadeMaxima(1, 0), 10, 1, {
      ...zerados,
      inteligencia: 16,
    })

    expect(soForca.xp).toBeGreaterThan(soInteligencia.xp)
  })

  it('o poder de ataque do loadout substitui a conta por atributo', () => {
    // Quem tem equipamento não é medido pelos atributos crus: o número que
    // entra no ciclo é o poder final, já com sinergia e conjunto aplicados.
    const semEquipamento = resolverCiclos(1, vitalidadeMaxima(1, 0), 10, 1, zerados)
    const comEquipamento = resolverCiclos(1, vitalidadeMaxima(1, 0), 10, 1, zerados, 64)

    expect(comEquipamento.xp).toBeGreaterThan(semEquipamento.xp)
  })

  it('Sorte ainda não tem efeito, e isso é declarado', () => {
    // O consumidor de Sorte é a chance de raridade no drop, que só existe com
    // `specs/dungeons-loot-skins.md`.
    const semSorte = resolverCiclos(1, vitalidadeMaxima(1, 0), 10, 1, zerados)
    const comSorte = resolverCiclos(1, vitalidadeMaxima(1, 0), 10, 1, { ...zerados, sorte: 500 })

    expect(comSorte).toEqual(semSorte)
  })

  it('sem atributos, o resultado é idêntico ao da Fase 1', () => {
    // Garante que acrescentar atributos não mudou o comportamento de quem não
    // tem nenhum ponto alocado.
    expect(resolverCiclos(1, vitalidadeMaxima(1, 0), 13, 1, zerados)).toEqual(
      resolverCiclos(1, vitalidadeMaxima(1), 13, 1),
    )
  })
})

describe('teto de farm offline', () => {
  it('dá 24h ao assinante, sem depender de anúncio (core, 4)', () => {
    expect(tetoOfflineMinutos(true, 0)).toBe(TETO_ASSINANTE_MIN)
    expect(TETO_ASSINANTE_MIN).toBe(24 * 60)
  })

  it('dá 0 ao não-assinante sem anúncio (core, 5)', () => {
    expect(tetoOfflineMinutos(false, 0)).toBe(0)
  })

  it('dá exatamente o saldo de anúncio ao não-assinante (core, 6)', () => {
    expect(tetoOfflineMinutos(false, 45)).toBe(45)
    expect(tetoOfflineMinutos(false, TETO_ANUNCIO_DIARIO_MIN)).toBe(120)
  })
})
