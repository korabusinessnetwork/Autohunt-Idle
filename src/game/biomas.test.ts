import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { BIOMAS, TOTAL_BIOMAS, biomaPorId } from './biomas'
import { POOL_INIMIGOS } from './mundo'

// `biomas.ts` encolheu em 2026-08-13: a geometria (grade, intensidade, pool por
// posição) mudou-se para `mapas.ts` quando cada bioma virou um mapa
// instanciado. Os testes de geometria foram junto — estão em `mapas.test.ts`.
//
// O que ficou aqui é o que sempre foi o núcleo: bioma é TEMA, e tema não
// credita.

describe('bioma é cenário, e só cenário', () => {
  it('nenhuma migration declara bioma nem mapa', () => {
    // A prova central, e ela sobreviveu a duas inversões de premissa (o mundo
    // aberto e os mapas instanciados). Se "estar no mapa 7" mudasse um número
    // creditado, a regra que sustenta o produto passaria a depender do
    // navegador do jogador.
    //
    // Os comentários saem antes da checagem: uma migration PODE citar a spec ou
    // explicar que aquele número é de tela. O que ela não pode é ter coluna,
    // parâmetro ou condição de bioma/mapa. Comentário é prosa; contrato é o SQL
    // que roda.
    const pasta = new URL('../../supabase/migrations/', import.meta.url)
    const sql = readdirSync(pasta)
      .filter((arquivo) => arquivo.endsWith('.sql'))
      .map((arquivo) => readFileSync(new URL(arquivo, pasta), 'utf8'))
      .join('\n')
      .replace(/--[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .toLowerCase()

    expect(sql).not.toContain('bioma')
    expect(sql).not.toContain('mapa')
  })

  it('nenhum módulo de regra importa cenário', () => {
    const pasta = new URL('./', import.meta.url)
    const regras = readdirSync(pasta).filter(
      (arquivo) => arquivo.startsWith('regras') && arquivo.endsWith('.ts'),
    )
    expect(regras.length).toBeGreaterThan(0)

    for (const arquivo of regras) {
      const conteudo = readFileSync(new URL(arquivo, pasta), 'utf8')
      expect(conteudo, `${arquivo} não pode importar biomas`).not.toMatch(/from '\.\/biomas'/)
      expect(conteudo, `${arquivo} não pode importar mapas`).not.toMatch(/from '\.\/mapas'/)
    }
  })

  it('nenhuma cor de bioma nasce em TypeScript', () => {
    const conteudo = readFileSync(new URL('./biomas.ts', import.meta.url), 'utf8')
    expect(conteudo).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })

  it('o nível não influencia o tema', () => {
    // A mudança de premissa de 2026-08-12 em uma linha, e ela continua valendo:
    // `biomas.ts` não conhece nível. Quem conhece é `mapas.ts`, e só para
    // decidir o que está destravado — nunca para calcular nada.
    const conteudo = readFileSync(new URL('./biomas.ts', import.meta.url), 'utf8')
    expect(conteudo).not.toMatch(/\bnivel\b/i)
  })
})

describe('o catálogo dos 8 temas', () => {
  it('cada bioma tem nome, token e assinatura próprios', () => {
    expect(BIOMAS).toHaveLength(TOTAL_BIOMAS)
    expect(new Set(BIOMAS.map((b) => b.nome)).size).toBe(TOTAL_BIOMAS)
    expect(new Set(BIOMAS.map((b) => b.token)).size).toBe(TOTAL_BIOMAS)
    expect(new Set(BIOMAS.map((b) => b.assinatura.forma)).size).toBe(TOTAL_BIOMAS)
  })

  it('nenhum assinatura repete uma forma do pool base', () => {
    const base = new Set(POOL_INIMIGOS.map((e) => e.forma))
    for (const bioma of BIOMAS) expect(base.has(bioma.assinatura.forma as never)).toBe(false)
  })

  it('todo inimigo tem dano — inclusive os assinatura', () => {
    // O defeito relatado era "monstro não dá dano". Uma espécie que escapasse
    // sem `dano` daria `NaN` no golpe, e `NaN` não tira vida de ninguém: o
    // defeito voltaria por um caminho que ninguém olha.
    for (const especie of [...POOL_INIMIGOS, ...BIOMAS.map((b) => b.assinatura)]) {
      expect(Number.isFinite(especie.dano), `${especie.forma} sem dano`).toBe(true)
      expect(especie.dano, `${especie.forma} com dano zero`).toBeGreaterThan(0)
    }
  })

  it('id desconhecido devolve o primeiro bioma em vez de quebrar', () => {
    // Tela branca é o que o Princípio nº1 proíbe acima de tudo.
    for (const id of [0, -1, 99, Number.NaN]) {
      expect(biomaPorId(id).id).toBe(1)
    }
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
