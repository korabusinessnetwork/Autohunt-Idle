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

describe('a lista de atributos', () => {
  it('a alocação vazia cobre a lista inteira — nem mais, nem menos', () => {
    // O `tsc` já reprova quem acrescenta um atributo em `ATRIBUTOS` e esquece o
    // literal de `atributosZerados`. Este teste é a rede para quem roda só o
    // vitest, que NÃO faz typecheck: o atributo esquecido viraria `undefined`,
    // e `custoAcumulado(undefined)` devolve NaN em silêncio — o guard
    // `nivel <= 0` não pega `undefined`.
    expect(Object.keys(atributosZerados()).sort()).toEqual([...ATRIBUTOS].sort())
  })

  it('nenhum atributo fica fora da conta de custo', () => {
    for (const chave of ATRIBUTOS) {
      const alocacao = { ...atributosZerados(), [chave]: 3 } as Atributos
      expect(custoTotalDaAlocacao(alocacao), chave).toBe(custoAcumulado(3))
      expect(Number.isNaN(custoTotalDaAlocacao(alocacao)), chave).toBe(false)
    }
  })

  it('Destreza existe, e Força vem antes dela', () => {
    // A ordem não é cosmética: o andaime `distribuir` (e a tela) percorrem esta
    // lista, e o primeiro empatado é quem recebe o ponto.
    expect(ATRIBUTOS).toContain('destreza')
    expect(ATRIBUTOS.indexOf('forca')).toBeLessThan(ATRIBUTOS.indexOf('destreza'))
  })
})

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
    const antes: Atributos = { ...atributosZerados(), forca: 10 }
    const depois: Atributos = { ...atributosZerados(), forca: 11 }

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
    expect(validarAlocacao({ ...atributosZerados(), forca: 999 }, 5)).toEqual({
      valida: false,
      erro: 'PONTOS_INSUFICIENTES',
    })
  })

  it('rejeita valor negativo ou fracionário', () => {
    expect(validarAlocacao({ ...atributosZerados(), forca: -1 }, 100)).toEqual({
      valida: false,
      erro: 'ATRIBUTO_INVALIDO',
    })
    expect(validarAlocacao({ ...atributosZerados(), forca: 1.5 }, 100)).toEqual({
      valida: false,
      erro: 'ATRIBUTO_INVALIDO',
    })
  })

  it('valida o atributo NOVO como valida qualquer outro', () => {
    // Destreza chegou como quinto atributo em 2026-08-14. Um atributo que a
    // validação não enxerga é um atributo que o jogador consegue inflar de
    // graça — e o custo é conferido pelo total acumulado, não campo a campo.
    expect(validarAlocacao({ ...atributosZerados(), destreza: 999 }, 5)).toEqual({
      valida: false,
      erro: 'PONTOS_INSUFICIENTES',
    })
    expect(validarAlocacao({ ...atributosZerados(), destreza: -1 }, 100)).toEqual({
      valida: false,
      erro: 'ATRIBUTO_INVALIDO',
    })
  })

  it('aceita o jogador de nível 1 sem nenhum ponto', () => {
    expect(validarAlocacao(atributosZerados(), 1)).toEqual({ valida: true })
    expect(pontosDisponiveis(atributosZerados(), 1)).toBe(0)
  })
})
