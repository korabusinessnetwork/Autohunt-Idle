import { describe, expect, it } from 'vitest'

import {
  ATRIBUTOS,
  PONTOS_POR_NIVEL,
  atributosZerados,
  custoAcumulado,
  custoDoProximoNivel,
  custoTotalDaAlocacao,
  pontosDisponiveis,
  pontosGanhosAte,
  validarAlocacao,
  type Atributo,
  type Atributos,
} from './regrasAtributos'

/**
 * Gasta um saldo inteiro, sempre no atributo mais barato. **Andaime de teste**,
 * não regra de jogo: a auto-alocação saiu do produto em 2026-08-13, e o que
 * sobrou aqui é só uma forma de fabricar uma alocação plausível para exercitar
 * respec e validação sem hardcodar números que ninguém consegue conferir de
 * cabeça.
 */
function distribuir(saldo: number): Atributos {
  const atributos = atributosZerados()
  let pontos = Math.max(0, saldo)

  for (;;) {
    let alvo: Atributo = ATRIBUTOS[0]
    for (const chave of ATRIBUTOS) if (atributos[chave] < atributos[alvo]) alvo = chave

    const custo = custoDoProximoNivel(atributos[alvo])
    if (custo > pontos) return atributos
    pontos -= custo
    atributos[alvo] += 1
  }
}

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
  it('não dá ponto no nível 1 e dá 1 por level up', () => {
    expect(PONTOS_POR_NIVEL).toBe(1)
    expect(pontosGanhosAte(1)).toBe(0)
    expect(pontosGanhosAte(2)).toBe(1)
    expect(pontosGanhosAte(11)).toBe(10)
  })

  it('o jogador chega ao nível 11 com pontos para UM atributo em 10, e nada além', () => {
    // O que a mudança de 3 para 1 significa na prática, em número: dez níveis
    // compram dez pontos, e dez pontos compram exatamente dez níveis de um
    // atributo só — o décimo primeiro já custa 2.
    expect(pontosGanhosAte(11)).toBe(custoAcumulado(10))
    expect(pontosGanhosAte(11)).toBeLessThan(custoAcumulado(11))
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
    const atributos = distribuir(pontosGanhosAte(nivel))

    expect(pontosDisponiveis(atributosZerados(), nivel)).toBe(pontosGanhosAte(nivel))
    expect(custoTotalDaAlocacao(atributos)).toBeLessThanOrEqual(pontosGanhosAte(nivel))
  })
})

describe('validação de alocação', () => {
  it('aceita a alocação que cabe nos pontos ganhos', () => {
    const nivel = 50
    const atributos = distribuir(pontosGanhosAte(nivel))
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
