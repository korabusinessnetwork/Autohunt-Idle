import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  ALTURA_MAPA,
  BLOCOS_POR_MAPA,
  LARGURA_MAPA,
  MAPAS,
  NIVEIS_POR_MAPA,
  NIVEL_DA_ULTIMA_LEVA,
  TOTAL_MAPAS,
  entradaDoMapa,
  escalaDoMapa,
  intensidadeDaPosicao,
  mapaLiberado,
  mapaPorId,
  mapaSugerido,
  niveisParaLiberar,
  FATIA_DO_ASSINATURA,
  especieQueNasce,
  poolDoMapa,
} from './mapas'
import { POOL_INIMIGOS } from './mundo'

describe('as duas levas de mapas', () => {
  it('são 16 mapas cobrindo até o nível 160', () => {
    // Dobrou em 2026-08-19 com o arco da fábrica morta. Os números ficam
    // escritos à mão de propósito: derivar de `TOTAL_MAPAS` faria o teste
    // concordar com qualquer valor, inclusive com uma leva pela metade.
    expect(TOTAL_MAPAS).toBe(16)
    expect(NIVEL_DA_ULTIMA_LEVA).toBe(80)
    expect(MAPAS).toHaveLength(16)
  })

  it('os mapas abrem de 5 em 5, começando no nível 1', () => {
    // Era de 10 em 10, e os dezesseis só terminavam de abrir no nível 151. O
    // dono viu isso na tela como "os mapas não mudam", e estava certo: no nível
    // 1 o painel tinha 15 cadeados. A 5, os dezesseis cabem nos mesmos 80
    // níveis que a primeira leva de oito já cobria.
    expect(MAPAS.map((mapa) => mapa.nivelMinimo)).toEqual([
      1, 6, 11, 16, 21, 26, 31, 36, 41, 46, 51, 56, 61, 66, 71, 76,
    ])
  })

  it('cada mapa tem um tema só dele', () => {
    expect(new Set(MAPAS.map((mapa) => mapa.bioma.id)).size).toBe(TOTAL_MAPAS)
  })

  it('o primeiro mapa está aberto para quem acabou de criar a conta', () => {
    // Se o mapa 1 exigisse qualquer nível, o jogo abriria numa tela de bloqueio.
    expect(mapaLiberado(MAPAS[0]!, 1)).toBe(true)
  })
})

describe('destravamento por nível', () => {
  it('o nível exato do mínimo já libera', () => {
    // Fronteira clássica de erro em jogo idle: "faltam 0 níveis" e o botão
    // continua cinza.
    for (const mapa of MAPAS) {
      expect(mapaLiberado(mapa, mapa.nivelMinimo), `mapa ${mapa.id}`).toBe(true)
      // O mapa 1 fica de fora do "um abaixo": abaixo dele é o nível 0, que não
      // existe — e que precisa abrir o jogo, não fechá-lo.
      if (mapa.id > 1) {
        expect(mapaLiberado(mapa, mapa.nivelMinimo - 1), `mapa ${mapa.id}`).toBe(false)
      }
    }
  })

  it('niveisParaLiberar conta certo e nunca fica negativo', () => {
    // O mapa 4 abre no nível 16 desde que o passo caiu de 10 para 5.
    expect(niveisParaLiberar(MAPAS[3]!, 10)).toBe(6)
    expect(niveisParaLiberar(MAPAS[3]!, 16)).toBe(0)
    expect(niveisParaLiberar(MAPAS[3]!, 900)).toBe(0)
  })

  it('nível inválido é tratado como nível 1, não como bloqueio total', () => {
    // O nível vem do servidor por snapshot. Enquanto o primeiro snapshot não
    // chega, o valor pode ser 0/NaN — e a tela precisa abrir mesmo assim.
    for (const nivel of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(mapaLiberado(MAPAS[0]!, nivel), `nível ${nivel}`).toBe(true)
    }
  })
})

describe('mapaSugerido', () => {
  it('não empurra o jogador para um mapa que ele não pode entrar', () => {
    // O defeito que este teste existe para impedir já aconteceu: a primeira
    // versão era `floor(nivel / 10) + 1`, que no nível 10 sugeria o mapa 2 —
    // que só abre no 11. O jogo abriria travado.
    for (let nivel = 1; nivel <= 400; nivel++) {
      const mapa = mapaSugerido(nivel)
      expect(mapaLiberado(mapa, nivel), `nível ${nivel} → mapa ${mapa.id}`).toBe(true)
    }
  })

  it('vira de mapa exatamente na virada da faixa', () => {
    expect(mapaSugerido(1).id).toBe(1)
    expect(mapaSugerido(5).id).toBe(1)
    expect(mapaSugerido(6).id).toBe(2)
    expect(mapaSugerido(10).id).toBe(2)
    expect(mapaSugerido(36).id).toBe(8)
    // A virada para a fábrica morta: o nível 41 é onde o universo doce acaba.
    expect(mapaSugerido(40).id).toBe(8)
    expect(mapaSugerido(41).id).toBe(9)
    expect(mapaSugerido(76).id).toBe(16)
  })

  it('passar de 80 não trava nada — segue no último mapa', () => {
    // Nível infinito é core do produto. Faltar mapa novo é conteúdo pendente,
    // não teto: o nível 999 continua jogando.
    expect(mapaSugerido(NIVEL_DA_ULTIMA_LEVA).id).toBe(TOTAL_MAPAS)
    expect(mapaSugerido(81).id).toBe(TOTAL_MAPAS)
    expect(mapaSugerido(999).id).toBe(TOTAL_MAPAS)
  })

  it('nível inválido cai no primeiro mapa em vez de quebrar', () => {
    for (const nivel of [0, -1, Number.NaN]) {
      expect(mapaSugerido(nivel).id, `nível ${nivel}`).toBe(1)
    }
  })
})

describe('mapaPorId', () => {
  it('id fora da leva devolve o primeiro mapa', () => {
    // `mapaId` sobrevive em estado local; uma leva futura removida ou um valor
    // corrompido não pode virar tela branca.
    for (const id of [0, -3, 99, Number.NaN]) {
      expect(mapaPorId(id).id, `id ${id}`).toBe(1)
    }
  })

  it('id válido devolve o mapa correspondente', () => {
    for (const mapa of MAPAS) expect(mapaPorId(mapa.id)).toBe(mapa)
  })
})

describe('geometria da arena', () => {
  it('o herói entra no centro do mapa', () => {
    expect(entradaDoMapa()).toEqual({ x: LARGURA_MAPA / 2, y: ALTURA_MAPA / 2 })
  })

  it('a intensidade cresce do centro para a borda', () => {
    const centro = intensidadeDaPosicao(LARGURA_MAPA / 2, ALTURA_MAPA / 2)
    const meio = intensidadeDaPosicao(LARGURA_MAPA * 0.75, ALTURA_MAPA / 2)
    const canto = intensidadeDaPosicao(LARGURA_MAPA - 1, ALTURA_MAPA - 1)

    expect(centro).toBe(0)
    expect(meio).toBeGreaterThan(centro)
    expect(canto).toBeGreaterThanOrEqual(meio)
  })

  it('a intensidade fica entre 0 e 1 em qualquer ponto, inclusive fora do mapa', () => {
    const pontos = [
      [-9999, -9999],
      [0, 0],
      [LARGURA_MAPA * 2, ALTURA_MAPA * 2],
      [Number.NaN, 40],
      [40, Number.NaN],
    ] as const

    for (const [x, y] of pontos) {
      const valor = intensidadeDaPosicao(x, y)
      expect(Number.isFinite(valor), `${x},${y}`).toBe(true)
      expect(valor).toBeGreaterThanOrEqual(0)
      expect(valor).toBeLessThanOrEqual(1)
    }
  })

  it('a intensidade anda em degraus, não continuamente', () => {
    const degraus = new Set<number>()
    for (let x = 0; x < LARGURA_MAPA; x += 7) degraus.add(intensidadeDaPosicao(x, ALTURA_MAPA / 2))
    expect(degraus.size).toBeLessThanOrEqual(BLOCOS_POR_MAPA)
  })

  it('a arena é a mesma para todos os mapas', () => {
    // Dificuldade percebida vem do tema e da população; metragem diferente por
    // mapa só criaria a suspeita de que o mapa grande rende mais.
    expect(LARGURA_MAPA).toBeGreaterThan(0)
    expect(ALTURA_MAPA).toBeGreaterThan(0)
  })
})

describe('população do mapa', () => {
  it('o pool é o base MAIS o assinatura, nunca no lugar dele', () => {
    for (const mapa of MAPAS) {
      const pool = poolDoMapa(POOL_INIMIGOS, mapa)
      expect(pool).toHaveLength(POOL_INIMIGOS.length + 1)
      for (const base of POOL_INIMIGOS) expect(pool).toContain(base)
      expect(pool).toContain(mapa.bioma.assinatura)
    }
  })

  it('o assinatura é a maior fatia do que nasce, e o base divide o resto', () => {
    // A conta que motivou a mudança: com sorteio igual entre 5 base e 1
    // assinatura, o bicho exclusivo saía em 16% dos nascimentos, e 84% do que
    // aparecia era idêntico nos dezesseis mapas. Viajar trocava o chão e
    // deixava a fauna igual.
    //
    // Varre o sorteio inteiro em vez de amostrar: a função é pura e a
    // distribuição é exata, então não há por que aceitar margem de ruído.
    const PASSOS = 100000
    for (const mapa of [MAPAS[0]!, MAPAS[8]!, MAPAS[15]!]) {
      const conta = new Map<string, number>()
      for (let i = 0; i < PASSOS; i++) {
        const especie = especieQueNasce(POOL_INIMIGOS, mapa, i / PASSOS)
        const forma = especie!.forma
        conta.set(forma, (conta.get(forma) ?? 0) + 1)
      }

      const assinatura = mapa.bioma.assinatura.forma
      const fatia = (conta.get(assinatura) ?? 0) / PASSOS
      expect(fatia, `assinatura do mapa ${mapa.id}`).toBeCloseTo(FATIA_DO_ASSINATURA, 2)

      // Nenhum base pode chegar perto do assinatura: é isso que dá cara ao mapa.
      for (const base of POOL_INIMIGOS) {
        const dele = (conta.get(base.forma) ?? 0) / PASSOS
        expect(dele, `${base.forma} no mapa ${mapa.id}`).toBeLessThan(fatia / 2)
        // E nenhum some: o pool compartilhado é o que dá continuidade.
        expect(dele, `${base.forma} sumiu do mapa ${mapa.id}`).toBeGreaterThan(0.05)
      }
    }
  })

  it('sorteio fora da faixa não devolve nada nulo', () => {
    // O sorteio vem do gerador com semente. Um valor estranho não pode deixar
    // o ninho sem nascer ninguém — isso esvaziaria o mapa em silêncio.
    for (const sorteio of [0, 1, -3, 99, Number.NaN, Number.POSITIVE_INFINITY]) {
      const especie = especieQueNasce(POOL_INIMIGOS, MAPAS[0]!, sorteio)
      expect(especie, `sorteio ${sorteio}`).toBeTruthy()
    }
    // Pool base vazio ainda nasce o assinatura, em vez de devolver nulo.
    expect(especieQueNasce([], MAPAS[0]!, 0.99)).toBe(MAPAS[0]!.bioma.assinatura)
  })

  it('a escala sobe com o mapa e começa em 1', () => {
    expect(escalaDoMapa(MAPAS[0]!)).toBe(1)
    for (let i = 1; i < MAPAS.length; i++) {
      expect(escalaDoMapa(MAPAS[i]!)).toBeGreaterThan(escalaDoMapa(MAPAS[i - 1]!))
    }
  })
})

describe('mapa não credita', () => {
  it('nenhum módulo de regra importa mapas', () => {
    const pasta = new URL('./', import.meta.url)
    const regras = readdirSync(pasta).filter(
      (arquivo) => arquivo.startsWith('regras') && arquivo.endsWith('.ts'),
    )
    expect(regras.length).toBeGreaterThan(0)

    for (const arquivo of regras) {
      const conteudo = readFileSync(new URL(arquivo, pasta), 'utf8')
      expect(conteudo, `${arquivo} não pode importar mapas`).not.toMatch(/from '\.\/mapas'/)
    }
  })

  it('escalaDoMapa não aparece em nenhum cálculo de recompensa', () => {
    // A tentação óbvia da próxima leva: "mapa 8 rende mais". No dia em que
    // render, o cliente passa a decidir ganho — e o cliente é o navegador do
    // jogador.
    const pasta = new URL('./', import.meta.url)
    const regras = readdirSync(pasta).filter(
      (arquivo) => arquivo.startsWith('regras') && arquivo.endsWith('.ts'),
    )
    for (const arquivo of regras) {
      const conteudo = readFileSync(new URL(arquivo, pasta), 'utf8')
      expect(conteudo, arquivo).not.toContain('escalaDoMapa')
    }
  })

  it('o mapa escolhido não vai para o servidor', () => {
    // `mapaId` mora em estado de tela. Se um dia virar coluna, o teste de
    // migrations em `biomas.test.ts` também cai — de propósito, são duas
    // fechaduras na mesma porta.
    const pasta = new URL('../lib/services/', import.meta.url)
    const servicos = readdirSync(pasta).filter((arquivo) => arquivo.endsWith('.ts'))
    expect(servicos.length).toBeGreaterThan(0)

    for (const arquivo of servicos) {
      const conteudo = readFileSync(new URL(arquivo, pasta), 'utf8')
      // Procura o mapa como DADO — `mapaId`, `mapa_id`, `mapa:` num payload —
      // e não a palavra solta, que aparece legitimamente em referência a spec.
      expect(conteudo, `${arquivo} não pode enviar mapa`).not.toMatch(
        /\bmapa(Id|_id)\b|\bmapa\s*:/i,
      )
    }
  })
})

describe('a leva é coerente com os temas', () => {
  it('um mapa por bioma, na ordem do catálogo', () => {
    MAPAS.forEach((mapa, indice) => {
      expect(mapa.bioma.id).toBe(indice + 1)
      expect(mapa.nivelMinimo).toBe(indice * NIVEIS_POR_MAPA + 1)
    })
  })
})
