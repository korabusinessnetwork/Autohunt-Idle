import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  BIOMAS,
  BLOCOS_POR_BIOMA,
  NIVEIS_POR_BIOMA,
  NIVEL_MAXIMO_PLANEJADO,
  TOTAL_BIOMAS,
  biomaDoNivel,
  blocoDoNivel,
  intensidadeDoBloco,
  poolDoBioma,
} from './biomas'
import { POOL_INIMIGOS } from './mundo'

describe('bioma é cenário, e só cenário', () => {
  it('nenhuma migration menciona bioma', () => {
    // A prova central desta rodada. O mundo aberto é simulação visual: se
    // "estar no bioma 7" mudasse um número que o servidor credita, a regra que
    // sustenta o produto (o client nunca declara ganho) passaria a depender de
    // um cálculo que roda no navegador do jogador.
    const pasta = new URL('../../supabase/migrations/', import.meta.url)
    const sql = readdirSync(pasta)
      .filter((arquivo) => arquivo.endsWith('.sql'))
      .map((arquivo) => readFileSync(new URL(arquivo, pasta), 'utf8'))
      .join('\n')
      .toLowerCase()

    expect(sql).not.toContain('bioma')
  })

  it('nenhum módulo de regra importa biomas', () => {
    // A outra direção: as regras puras que espelham o cálculo do servidor não
    // podem passar a depender do cenário.
    const pasta = new URL('./', import.meta.url)
    const regras = readdirSync(pasta).filter(
      (arquivo) => arquivo.startsWith('regras') && arquivo.endsWith('.ts'),
    )
    expect(regras.length).toBeGreaterThan(0)

    for (const arquivo of regras) {
      const conteudo = readFileSync(new URL(arquivo, pasta), 'utf8')
      expect(conteudo, `${arquivo} não pode importar biomas`).not.toMatch(/from '\.\/biomas'/)
    }
  })

  it('nenhuma cor de bioma nasce em TypeScript', () => {
    // `src/styles/tokens.css` é a fonte única da paleta. Um hex aqui faria a
    // cor existir em dois lugares, e um deles ficaria desatualizado.
    const conteudo = readFileSync(new URL('./biomas.ts', import.meta.url), 'utf8')
    expect(conteudo).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })
})

describe('fronteiras dos 8 biomas', () => {
  it('cobre o nível 1 ao 1000 sem buraco e sem sobreposição', () => {
    // Nível a nível, não por amostragem: erro de fronteira é o tipo de coisa
    // que passa por três exemplos escolhidos a dedo.
    for (let nivel = 1; nivel <= NIVEL_MAXIMO_PLANEJADO; nivel++) {
      const esperado = Math.floor((nivel - 1) / NIVEIS_POR_BIOMA) + 1
      expect(biomaDoNivel(nivel).id, `nível ${nivel}`).toBe(esperado)
    }
  })

  it('as fronteiras caem exatamente a cada 125 níveis', () => {
    expect(biomaDoNivel(125).id).toBe(1)
    expect(biomaDoNivel(126).id).toBe(2)
    expect(biomaDoNivel(250).id).toBe(2)
    expect(biomaDoNivel(251).id).toBe(3)
    expect(biomaDoNivel(875).id).toBe(7)
    expect(biomaDoNivel(876).id).toBe(8)
    expect(biomaDoNivel(1000).id).toBe(8)
  })

  it('acima de 1000 permanece no bioma 8', () => {
    // O nível é infinito (`specs/ranking-global.md`); o conteúdo visual não.
    for (const nivel of [1001, 1500, 99_999, Number.MAX_SAFE_INTEGER]) {
      expect(biomaDoNivel(nivel).id, `nível ${nivel}`).toBe(TOTAL_BIOMAS)
      expect(blocoDoNivel(nivel)).toBe(BLOCOS_POR_BIOMA)
      expect(intensidadeDoBloco(nivel)).toBe(1)
    }
  })

  it('nível inválido cai no bioma 1 sem quebrar', () => {
    // O nível chega do snapshot — de fora deste módulo. Tela branca é o que o
    // Princípio nº1 proíbe acima de tudo.
    for (const nivel of [0, -5, Number.NaN, Number.POSITIVE_INFINITY * 0, 0.4]) {
      expect(biomaDoNivel(nivel).id, `nível ${nivel}`).toBe(1)
      expect(blocoDoNivel(nivel)).toBe(1)
    }
  })
})

describe('blocos e escalada visual', () => {
  it('cada bioma tem 5 blocos de 25 níveis', () => {
    expect(blocoDoNivel(1)).toBe(1)
    expect(blocoDoNivel(25)).toBe(1)
    expect(blocoDoNivel(26)).toBe(2)
    expect(blocoDoNivel(125)).toBe(5)
    // O bloco reinicia no bioma seguinte.
    expect(blocoDoNivel(126)).toBe(1)
    expect(blocoDoNivel(150)).toBe(1)
    expect(blocoDoNivel(151)).toBe(2)
  })

  it('a intensidade vai de 0 a 1 dentro do bioma', () => {
    expect(intensidadeDoBloco(1)).toBe(0)
    expect(intensidadeDoBloco(125)).toBe(1)
    expect(intensidadeDoBloco(126)).toBe(0)

    // E cresce monotonicamente bloco a bloco.
    let anterior = -1
    for (let bloco = 0; bloco < BLOCOS_POR_BIOMA; bloco++) {
      const atual = intensidadeDoBloco(bloco * 25 + 1)
      expect(atual).toBeGreaterThan(anterior)
      anterior = atual
    }
  })
})

describe('pool de inimigos por bioma', () => {
  it('o assinatura SOMA ao pool base, nunca substitui', () => {
    // Critério 7 da spec de origem, e a diferença entre 13 desenhos e 40.
    for (let bioma = 0; bioma < TOTAL_BIOMAS; bioma++) {
      const nivel = bioma * NIVEIS_POR_BIOMA + 1
      const pool = poolDoBioma(POOL_INIMIGOS, nivel)

      expect(pool).toHaveLength(POOL_INIMIGOS.length + 1)
      for (const base of POOL_INIMIGOS) {
        expect(pool, `bioma ${bioma + 1} perdeu ${base.forma}`).toContain(base)
      }
      expect(pool.at(-1)).toBe(BIOMAS[bioma]!.assinatura)
    }
  })

  it('cada bioma tem um assinatura exclusivo', () => {
    const formas = BIOMAS.map((b) => b.assinatura.forma)
    expect(new Set(formas).size).toBe(TOTAL_BIOMAS)

    // E nenhum deles repete uma forma do pool base.
    const base = new Set(POOL_INIMIGOS.map((e) => e.forma))
    for (const forma of formas) expect(base.has(forma)).toBe(false)
  })

  it('os 8 biomas têm nome e token próprios', () => {
    expect(BIOMAS).toHaveLength(TOTAL_BIOMAS)
    expect(new Set(BIOMAS.map((b) => b.nome)).size).toBe(TOTAL_BIOMAS)
    expect(new Set(BIOMAS.map((b) => b.token)).size).toBe(TOTAL_BIOMAS)
    expect(new Set(BIOMAS.map((b) => b.assinatura.nome)).size).toBe(TOTAL_BIOMAS)
  })
})

describe('tokens de bioma', () => {
  it('os 24 tokens existem em tokens.css', () => {
    // O canvas os lê em runtime; um token faltando só apareceria em produção,
    // como um cenário com a cor errada.
    const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8')

    for (let n = 1; n <= TOTAL_BIOMAS; n++) {
      for (const papel of ['fundo', 'detalhe', 'assinatura']) {
        expect(css, `--bioma-${n}-${papel}`).toContain(`--bioma-${n}-${papel}:`)
      }
    }
  })
})
