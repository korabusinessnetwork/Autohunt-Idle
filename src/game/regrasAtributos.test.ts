import { describe, expect, it } from 'vitest'

import {
  ATRIBUTOS,
  PONTOS_POR_NIVEL,
  atributosZerados,
  autoAlocar,
  custoAcumulado,
  custoDoProximoNivel,
  custoTotalDaAlocacao,
  pontosDisponiveis,
  pontosGanhosAte,
  validarAlocacao,
  type Atributos,
} from './regrasAtributos'

describe('custo por nível de atributo', () => {
  it('segue a fórmula que o critério 12 desempata', () => {
    // A prosa da spec dizia "níveis 10-19 custam 2"; a fórmula dizia outra
    // coisa. O exemplo do critério 12 — "subir de 10 pra 11 custou 2 pontos" —
    // é quem decide.
    expect(custoDoProximoNivel(9)).toBe(1)
    expect(custoDoProximoNivel(10)).toBe(2)
    expect(custoDoProximoNivel(19)).toBe(2)
    expect(custoDoProximoNivel(20)).toBe(3)
  })

  it('a forma fechada bate com o somatório, nível a nível', () => {
    let somatorio = 0
    for (let nivel = 0; nivel <= 250; nivel++) {
      expect(custoAcumulado(nivel), `nível ${nivel}`).toBe(somatorio)
      somatorio += custoDoProximoNivel(nivel)
    }
  })

  it('não cobra nada por nível zero ou negativo', () => {
    expect(custoAcumulado(0)).toBe(0)
    expect(custoAcumulado(-5)).toBe(0)
  })
})

describe('pontos ganhos', () => {
  it('não dá ponto no nível 1 e dá 3 por level up', () => {
    expect(pontosGanhosAte(1)).toBe(0)
    expect(pontosGanhosAte(2)).toBe(PONTOS_POR_NIVEL)
    expect(pontosGanhosAte(11)).toBe(10 * PONTOS_POR_NIVEL)
  })
})

describe('auto-alocação', () => {
  it('distribui de forma balanceada sem exigir nada do jogador', () => {
    // É o que faz o Princípio nº1 valer aqui: quem nunca abrir a tela joga com
    // uma build coerente.
    const { atributos } = autoAlocar(atributosZerados(), 8)

    const valores = ATRIBUTOS.map((chave) => atributos[chave])
    expect(Math.max(...valores) - Math.min(...valores)).toBeLessThanOrEqual(1)
  })

  it('gasta tudo que dá e devolve o troco', () => {
    const { atributos, pontosRestantes } = autoAlocar(atributosZerados(), 10)

    expect(custoTotalDaAlocacao(atributos) + pontosRestantes).toBe(10)
    // Com custo 1 por nível nessa faixa, os 10 pontos viram 10 níveis.
    expect(custoTotalDaAlocacao(atributos)).toBe(10)
    expect(pontosRestantes).toBe(0)
  })

  it('para quando o próximo nível não cabe no saldo', () => {
    // Todos em 10: o próximo nível de qualquer um custa 2.
    const atuais: Atributos = { forca: 10, inteligencia: 10, vitalidade: 10, sorte: 10 }
    const { atributos, pontosRestantes } = autoAlocar(atuais, 1)

    expect(atributos).toEqual(atuais)
    expect(pontosRestantes).toBe(1)
  })

  it('nunca cria nem destrói ponto, em qualquer saldo', () => {
    for (const saldo of [0, 1, 7, 50, 500, 5000]) {
      const { atributos, pontosRestantes } = autoAlocar(atributosZerados(), saldo)
      expect(custoTotalDaAlocacao(atributos) + pontosRestantes, `saldo ${saldo}`).toBe(saldo)
    }
  })

  it('respeita a alocação que já existia', () => {
    const atuais: Atributos = { forca: 5, inteligencia: 0, vitalidade: 0, sorte: 0 }
    const { atributos } = autoAlocar(atuais, 3)

    // Nunca reduz o que já estava alocado — o respec é do jogador, não do
    // sistema.
    expect(atributos.forca).toBeGreaterThanOrEqual(5)
    // E os pontos novos vão para quem está atrás.
    expect(atributos.inteligencia + atributos.vitalidade + atributos.sorte).toBe(3)
  })
})

describe('respec', () => {
  it('devolve exatamente o que cobrou', () => {
    // Prova central do critério 12: subir de 10 para 11 custa 2, então descer
    // de 11 para 10 precisa liberar os mesmos 2 — nem 1, nem 3.
    const nivel = 200
    const antes: Atributos = { forca: 10, inteligencia: 0, vitalidade: 0, sorte: 0 }
    const depois: Atributos = { forca: 11, inteligencia: 0, vitalidade: 0, sorte: 0 }

    expect(pontosDisponiveis(antes, nivel) - pontosDisponiveis(depois, nivel)).toBe(2)
    expect(custoTotalDaAlocacao(depois) - custoTotalDaAlocacao(antes)).toBe(2)
  })

  it('zerar tudo devolve todos os pontos ganhos', () => {
    const nivel = 60
    const { atributos } = autoAlocar(atributosZerados(), pontosGanhosAte(nivel))

    expect(pontosDisponiveis(atributosZerados(), nivel)).toBe(pontosGanhosAte(nivel))
    expect(custoTotalDaAlocacao(atributos)).toBeLessThanOrEqual(pontosGanhosAte(nivel))
  })
})

describe('validação de alocação', () => {
  it('aceita a alocação que cabe nos pontos ganhos', () => {
    const nivel = 50
    const { atributos } = autoAlocar(atributosZerados(), pontosGanhosAte(nivel))
    expect(validarAlocacao(atributos, nivel)).toEqual({ valida: true })
  })

  it('rejeita alocação que o jogador não pode pagar', () => {
    // A outra prova central: o servidor não aceita uma distribuição inventada.
    expect(validarAlocacao({ forca: 999, inteligencia: 0, vitalidade: 0, sorte: 0 }, 5)).toEqual({
      valida: false,
      erro: 'PONTOS_INSUFICIENTES',
    })
  })

  it('rejeita valor negativo ou fracionário', () => {
    expect(validarAlocacao({ forca: -1, inteligencia: 0, vitalidade: 0, sorte: 0 }, 100)).toEqual({
      valida: false,
      erro: 'ATRIBUTO_INVALIDO',
    })
    expect(validarAlocacao({ forca: 1.5, inteligencia: 0, vitalidade: 0, sorte: 0 }, 100)).toEqual({
      valida: false,
      erro: 'ATRIBUTO_INVALIDO',
    })
  })

  it('aceita o jogador de nível 1 sem nenhum ponto', () => {
    expect(validarAlocacao(atributosZerados(), 1)).toEqual({ valida: true })
    expect(pontosDisponiveis(atributosZerados(), 1)).toBe(0)
  })
})
