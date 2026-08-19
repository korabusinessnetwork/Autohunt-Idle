// O movimento procedural do herói, e SÓ ele.
//
// POR QUE NADA AQUI DESENHA: `vite.config.ts` fixa `environment: 'node'`, e o
// desenho de sprite pergunta `img instanceof HTMLCanvasElement` — identificador
// que não existe em node, então a pergunta lança `ReferenceError` em vez de
// responder `false`. Um teste que montasse um `ctx` falso morreria por causa do
// ambiente, não do código. A função de deslocamento é pura de propósito
// justamente para poder ser exercitada aqui.

import { describe, expect, it } from 'vitest'

import { QUADROS_LAMPEJO, QUADROS_MORTE } from './atlas'
import { DURACAO_LAMPEJO, DURACAO_MORTE } from './mundo'
import { deslocamentoDoHeroi, quadroDaMorte, quadroDoLampejo, type MovimentoDoHeroi } from './sprites'

const PARADO: MovimentoDoHeroi = { pose: 'parado', progresso: 0, faseDoPasso: 0, olhandoX: 1 }

/**
 * Teto de deslocamento, em pixels de mundo.
 *
 * O herói tem 42 px de altura. Passar de ~8 seria ou afundá-lo no chão ou
 * descolá-lo do arco do golpe, que nasce na posição real e não recebe offset.
 */
const TETO = 8

/** Varre um cubo de entradas grande o bastante para pegar extremos. */
function todasAsEntradas(): MovimentoDoHeroi[] {
  const entradas: MovimentoDoHeroi[] = []
  for (const pose of ['parado', 'atacando', 'comemorando'] as const) {
    for (let progresso = 0; progresso <= 1; progresso += 0.05) {
      for (let faseDoPasso = -1; faseDoPasso <= 2; faseDoPasso += 0.05) {
        for (const olhandoX of [-1, 0, 1]) {
          entradas.push({ pose, progresso, faseDoPasso, olhandoX })
        }
      }
    }
  }
  return entradas
}

describe('o herói se mexe sem depender de arte nova', () => {
  it('a skin não entra na conta — nem como argumento', () => {
    // "Skin nunca tem stat" é estrutural neste projeto, e a forma mais fácil de
    // furar a regra seria a skin cósmica pulando mais alto que a comum. A
    // função recebe UM argumento, e ele não tem onde guardar raridade: um campo
    // a mais é ignorado, então a regressão é impossível por construção.
    expect(deslocamentoDoHeroi.length).toBe(1)

    const andando: MovimentoDoHeroi = { ...PARADO, faseDoPasso: 0.3 }
    const comSkinCosmica = { ...andando, raridadeDaSkin: 10 }
    expect(deslocamentoDoHeroi(comSkinCosmica)).toEqual(deslocamentoDoHeroi(andando))
  })

  it('herói parado e sem pose não desloca nada', () => {
    // O estado de repouso precisa ser EXATAMENTE zero, e não "quase": um pixel
    // preso deixaria o boneco flutuando para sempre depois da primeira parada.
    expect(deslocamentoDoHeroi(PARADO)).toEqual({ dx: 0, dy: 0 })
  })

  it('o balanço do passo é periódico e não salta ao virar o ciclo', () => {
    // Ciclo que não fecha produz um tranco a cada passo — o defeito lê como
    // "sprite quebrado", que é pior que sprite parado.
    for (let fase = 0; fase < 1; fase += 0.05) {
      const aqui = deslocamentoDoHeroi({ ...PARADO, faseDoPasso: fase })
      const voltaDoCiclo = deslocamentoDoHeroi({ ...PARADO, faseDoPasso: fase + 1 })
      expect(voltaDoCiclo, `fase ${fase}`).toEqual(aqui)
    }

    // Continuidade: entre dois quadros vizinhos o herói nunca pula mais de um
    // pixel de mundo, inclusive na emenda do fim com o começo.
    let anterior = deslocamentoDoHeroi({ ...PARADO, faseDoPasso: 0 })
    for (let fase = 0.001; fase <= 2; fase += 0.001) {
      const atual = deslocamentoDoHeroi({ ...PARADO, faseDoPasso: fase })
      expect(Math.abs(atual.dy - anterior.dy), `fase ${fase}`).toBeLessThanOrEqual(1)
      anterior = atual
    }
  })

  it('o herói sobe no meio do passo — o balanço existe de verdade', () => {
    // O contrapeso do teste acima: "não salta" não pode virar "não se mexe".
    const noAlto = deslocamentoDoHeroi({ ...PARADO, faseDoPasso: 0.5 })
    expect(noAlto.dy).toBeLessThan(0)
  })

  it('nenhuma combinação joga o herói para longe', () => {
    for (const entrada of todasAsEntradas()) {
      const { dx, dy } = deslocamentoDoHeroi(entrada)
      const onde = `${entrada.pose} ${entrada.progresso} ${entrada.faseDoPasso}`
      expect(Math.abs(dx), onde).toBeLessThanOrEqual(TETO)
      expect(Math.abs(dy), onde).toBeLessThanOrEqual(TETO)
    }
  })

  it('o deslocamento é sempre inteiro, e nunca menos zero', () => {
    // Contrato anti-cintilação: a escala do renderizador já é fracionária e a
    // suavização está desligada, então offset quebrado muda quais linhas do
    // sprite somem a cada quadro e o detalhe interno "anda" sozinho.
    for (const entrada of todasAsEntradas()) {
      const { dx, dy } = deslocamentoDoHeroi(entrada)
      const onde = `${entrada.pose} ${entrada.progresso} ${entrada.faseDoPasso}`
      expect(Number.isInteger(dx), onde).toBe(true)
      expect(Number.isInteger(dy), onde).toBe(true)
      expect(Object.is(dx, -0), `${onde}: dx virou -0`).toBe(false)
      expect(Object.is(dy, -0), `${onde}: dy virou -0`).toBe(false)
    }
  })

  it('entrada quebrada não vira NaN na tela', () => {
    for (const valor of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const quebrado = { ...PARADO, progresso: valor, faseDoPasso: valor, olhandoX: valor }
      expect(deslocamentoDoHeroi(quebrado), `${valor}`).toEqual({ dx: 0, dy: 0 })
    }
  })
})

describe('cada pose se move do seu jeito', () => {
  const NO_PICO = 0.5

  it('o avanço do ataque é assinado por para onde o herói olha', () => {
    // E NÃO pelo espelhamento do sprite, que é interno ao desenho e acontece
    // depois: se o offset saísse de lá, o herói avançaria para trás sempre que
    // estivesse virado para a esquerda.
    const direita = deslocamentoDoHeroi({ ...PARADO, pose: 'atacando', progresso: NO_PICO })
    const esquerda = deslocamentoDoHeroi({
      ...PARADO,
      pose: 'atacando',
      progresso: NO_PICO,
      olhandoX: -1,
    })

    expect(direita.dx).toBeGreaterThan(0)
    expect(esquerda.dx).toBe(-direita.dx)
  })

  it('o gesto nasce e morre em zero — entrar e sair da pose não dá tranco', () => {
    for (const pose of ['atacando', 'comemorando'] as const) {
      const comecando = deslocamentoDoHeroi({ ...PARADO, pose, progresso: 1 })
      const acabando = deslocamentoDoHeroi({ ...PARADO, pose, progresso: 0 })
      expect(comecando, pose).toEqual({ dx: 0, dy: 0 })
      expect(acabando, pose).toEqual({ dx: 0, dy: 0 })
    }
  })

  it('atacar avança; comemorar pula — e um não vira o outro', () => {
    // `poseDoHeroi` já dá precedência ao ataque sobre a comemoração. Este teste
    // tranca as duas respostas separadas: se algum dia os gestos forem somados
    // em vez de escolhidos, o herói passaria a pular no meio do golpe.
    const atacando = deslocamentoDoHeroi({ ...PARADO, pose: 'atacando', progresso: NO_PICO })
    const comemorando = deslocamentoDoHeroi({ ...PARADO, pose: 'comemorando', progresso: NO_PICO })

    expect(atacando.dx).not.toBe(0)
    expect(atacando.dy).toBe(0)

    expect(comemorando.dx).toBe(0)
    expect(comemorando.dy).toBeLessThan(0)
  })
})

describe('apanhar e cair escolhem o quadro certo da folha', () => {
  // As duas contas correm em sentidos OPOSTOS — o lampejo é contagem
  // regressiva, a morte é tempo decorrido — e nenhuma das duas dá erro quando
  // inverte. O sintoma seria um bicho apanhando de trás para a frente, ou um
  // cadáver que começa achatado e se levanta. Coisa que só se vê olhando o
  // quadro exato, num evento que dura décimos de segundo.

  it('o lampejo começa no vulto branco e termina no corpo', () => {
    // Recém-atingido, `flash` vale a duração inteira: quadro 0, o vulto.
    expect(quadroDoLampejo(DURACAO_LAMPEJO)).toBe(0)
    // Acabando, sobra quase nada: o último quadro, o corpo de volta.
    expect(quadroDoLampejo(0.0001)).toBe(QUADROS_LAMPEJO - 1)
  })

  it('o lampejo avança, e nunca volta, ao longo de toda a duração', () => {
    let anterior = -1
    for (let flash = DURACAO_LAMPEJO; flash > 0; flash -= DURACAO_LAMPEJO / 60) {
      const quadro = quadroDoLampejo(flash)
      expect(quadro, `flash ${flash}`).toBeGreaterThanOrEqual(anterior)
      expect(quadro, `flash ${flash}`).toBeLessThan(QUADROS_LAMPEJO)
      anterior = quadro
    }
  })

  it('a morte começa de pé e termina no chão', () => {
    expect(quadroDaMorte(0)).toBe(0)
    expect(quadroDaMorte(DURACAO_MORTE * 0.99)).toBe(QUADROS_MORTE - 1)
  })

  it('a morte SATURA no último quadro em vez de dar a volta', () => {
    // Um `%` aqui faria o cadáver ressuscitar em laço no quadro em que o tempo
    // passa da duração e a lista ainda não foi filtrada.
    for (const tempo of [DURACAO_MORTE, DURACAO_MORTE * 2, 999]) {
      expect(quadroDaMorte(tempo), `tempo ${tempo}`).toBe(QUADROS_MORTE - 1)
    }
  })

  it('nenhuma das duas devolve quadro fora da folha — nem com lixo na entrada', () => {
    // As duas leem estado de simulação. Um quadro fora da faixa não estoura:
    // `drawImage` recorta fora da imagem e desenha NADA, e o bicho pisca para
    // fora de existência sem erro nenhum no console.
    const lixo = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -5, 1e9]
    for (const valor of lixo) {
      const lampejo = quadroDoLampejo(valor)
      expect(Number.isInteger(lampejo), `lampejo ${valor}`).toBe(true)
      expect(lampejo, `lampejo ${valor}`).toBeGreaterThanOrEqual(0)
      expect(lampejo, `lampejo ${valor}`).toBeLessThan(QUADROS_LAMPEJO)

      const morte = quadroDaMorte(valor)
      expect(Number.isInteger(morte), `morte ${valor}`).toBe(true)
      expect(morte, `morte ${valor}`).toBeGreaterThanOrEqual(0)
      expect(morte, `morte ${valor}`).toBeLessThan(QUADROS_MORTE)
    }
  })
})
