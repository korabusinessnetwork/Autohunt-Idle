import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  ALTURA_MAPA,
  ALTURA_REGIAO,
  BIOMAS,
  COLUNAS_DE_REGIAO,
  LARGURA_MAPA,
  LARGURA_REGIAO,
  TOTAL_BIOMAS,
  biomaDaPosicao,
  intensidadeDaPosicao,
  poolDaPosicao,
} from './biomas'
import { LARGURA_VIEWPORT, POOL_INIMIGOS } from './mundo'

describe('bioma é cenário, e só cenário', () => {
  it('nenhuma migration menciona bioma', () => {
    // A prova central, e ela sobreviveu à inversão de premissa
    // (`specs/mundo-aberto-e-modo-manual.md`): o mundo aberto é simulação
    // visual. Se "estar na região 7" mudasse um número creditado, a regra que
    // sustenta o produto passaria a depender do navegador do jogador.
    const pasta = new URL('../../supabase/migrations/', import.meta.url)
    const sql = readdirSync(pasta)
      .filter((arquivo) => arquivo.endsWith('.sql'))
      .map((arquivo) => readFileSync(new URL(arquivo, pasta), 'utf8'))
      .join('\n')
      .toLowerCase()

    expect(sql).not.toContain('bioma')
  })

  it('nenhum módulo de regra importa biomas', () => {
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
    const conteudo = readFileSync(new URL('./biomas.ts', import.meta.url), 'utf8')
    expect(conteudo).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })
})

describe('o mapa é dividido em 8 regiões', () => {
  it('cada célula da grade é um bioma distinto', () => {
    const vistos = new Set<number>()
    for (let linha = 0; linha < ALTURA_MAPA / ALTURA_REGIAO; linha++) {
      for (let coluna = 0; coluna < COLUNAS_DE_REGIAO; coluna++) {
        // Meio da célula, para não pegar fronteira.
        const bioma = biomaDaPosicao(
          coluna * LARGURA_REGIAO + LARGURA_REGIAO / 2,
          linha * ALTURA_REGIAO + ALTURA_REGIAO / 2,
        )
        expect(vistos.has(bioma.id), `região ${bioma.id} repetida`).toBe(false)
        vistos.add(bioma.id)
      }
    }
    expect(vistos.size).toBe(TOTAL_BIOMAS)
  })

  it('as fronteiras caem exatamente no múltiplo da região', () => {
    expect(biomaDaPosicao(LARGURA_REGIAO - 1, 0).id).toBe(1)
    expect(biomaDaPosicao(LARGURA_REGIAO, 0).id).toBe(2)
    expect(biomaDaPosicao(0, ALTURA_REGIAO - 1).id).toBe(1)
    // Passar para a linha de baixo salta uma linha inteira da grade.
    expect(biomaDaPosicao(0, ALTURA_REGIAO).id).toBe(COLUNAS_DE_REGIAO + 1)
    expect(biomaDaPosicao(LARGURA_MAPA - 1, ALTURA_MAPA - 1).id).toBe(TOTAL_BIOMAS)
  })

  it('o herói nasce na primeira região', () => {
    // `criarMundo` coloca o herói em (LARGURA_VIEWPORT, ALTURA_VIEWPORT).
    expect(biomaDaPosicao(LARGURA_VIEWPORT, LARGURA_VIEWPORT / 2).id).toBe(1)
  })

  it('posição fora do mapa ou inválida não quebra', () => {
    // A posição vem do mundo, mas nada garante que uma refatoração futura não
    // passe lixo. Tela branca é o que o Princípio nº1 proíbe acima de tudo.
    for (const [x, y] of [
      [-500, -500],
      [LARGURA_MAPA * 4, ALTURA_MAPA * 4],
      [Number.NaN, 0],
      [0, Number.NaN],
    ]) {
      const bioma = biomaDaPosicao(x!, y!)
      expect(bioma.id).toBeGreaterThanOrEqual(1)
      expect(bioma.id).toBeLessThanOrEqual(TOTAL_BIOMAS)
    }
  })

  it('o nível não influencia mais o cenário', () => {
    // A mudança de premissa em uma linha: `biomas.ts` não conhece nível.
    const conteudo = readFileSync(new URL('./biomas.ts', import.meta.url), 'utf8')
    expect(conteudo).not.toMatch(/\bnivel\b/i)
  })
})

describe('intensidade dentro da região', () => {
  it('fica entre 0 e 1 em qualquer ponto do mapa', () => {
    for (let x = 0; x < LARGURA_MAPA; x += 337) {
      for (let y = 0; y < ALTURA_MAPA; y += 211) {
        const i = intensidadeDaPosicao(x, y)
        expect(i, `(${x},${y})`).toBeGreaterThanOrEqual(0)
        expect(i, `(${x},${y})`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('cresce ao se afastar do canto de entrada da região', () => {
    expect(intensidadeDaPosicao(0, 0)).toBe(0)
    expect(intensidadeDaPosicao(LARGURA_REGIAO - 1, ALTURA_REGIAO - 1)).toBe(1)
    // E reinicia na região seguinte — cada uma tem sua própria escalada.
    expect(intensidadeDaPosicao(LARGURA_REGIAO, 0)).toBe(0)
  })
})

describe('pool de inimigos por região', () => {
  it('o assinatura SOMA ao pool base, nunca substitui', () => {
    for (let i = 0; i < TOTAL_BIOMAS; i++) {
      const coluna = i % COLUNAS_DE_REGIAO
      const linha = Math.floor(i / COLUNAS_DE_REGIAO)
      const x = coluna * LARGURA_REGIAO + 10
      const y = linha * ALTURA_REGIAO + 10

      const pool = poolDaPosicao(POOL_INIMIGOS, x, y)
      expect(pool).toHaveLength(POOL_INIMIGOS.length + 1)
      for (const base of POOL_INIMIGOS) expect(pool).toContain(base)
      expect(pool.at(-1)).toBe(BIOMAS[i]!.assinatura)
    }
  })

  it('cada bioma tem um assinatura exclusivo', () => {
    const formas = BIOMAS.map((b) => b.assinatura.forma)
    expect(new Set(formas).size).toBe(TOTAL_BIOMAS)

    const base = new Set(POOL_INIMIGOS.map((e) => e.forma))
    for (const forma of formas) expect(base.has(forma)).toBe(false)
  })

  it('os 8 biomas têm nome e token próprios', () => {
    expect(BIOMAS).toHaveLength(TOTAL_BIOMAS)
    expect(new Set(BIOMAS.map((b) => b.nome)).size).toBe(TOTAL_BIOMAS)
    expect(new Set(BIOMAS.map((b) => b.token)).size).toBe(TOTAL_BIOMAS)
  })
})

describe('tokens de bioma', () => {
  it('os 24 tokens existem em tokens.css', () => {
    const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8')
    for (let n = 1; n <= TOTAL_BIOMAS; n++) {
      for (const papel of ['fundo', 'detalhe', 'assinatura']) {
        expect(css, `--bioma-${n}-${papel}`).toContain(`--bioma-${n}-${papel}:`)
      }
    }
  })
})
