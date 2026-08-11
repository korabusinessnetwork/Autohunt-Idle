import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { detectarIdioma, traduzir } from './index'
import { en } from './en'
import { pt } from './pt'

// Lançamento bilíngue desde o dia 1 (core, 13 e 14).
//
// A paridade de chaves já é garantida pelo tipo — `en` é
// `Record<ChaveI18n, string>`, então faltar chave nem compila. Este teste
// cobre o que o tipo não pega: chave vazia, placeholder órfão e nome traduzido
// ao pé da letra.

describe('paridade entre os dicionários', () => {
  it('tem exatamente o mesmo conjunto de chaves', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(pt).sort())
  })

  it('não tem tradução vazia em nenhum idioma', () => {
    for (const [chave, valor] of Object.entries({ ...pt })) {
      expect(valor.trim(), `pt: ${chave}`).not.toBe('')
    }
    for (const [chave, valor] of Object.entries(en)) {
      expect(valor.trim(), `en: ${chave}`).not.toBe('')
    }
  })

  it('usa os mesmos placeholders nas duas línguas', () => {
    const placeholders = (texto: string) =>
      [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort()

    for (const chave of Object.keys(pt) as Array<keyof typeof pt>) {
      expect(placeholders(en[chave]), `divergência em ${chave}`).toEqual(placeholders(pt[chave]))
    }
  })
})

describe('nenhuma chave morta', () => {
  function arquivosDeCodigo(pasta: URL): string[] {
    return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
      const caminho = new URL(`${entrada.name}${entrada.isDirectory() ? '/' : ''}`, pasta)
      if (entrada.isDirectory()) return arquivosDeCodigo(caminho)
      if (!/\.tsx?$/.test(entrada.name) || entrada.name.includes('.test.')) return []
      // Os próprios dicionários não contam como uso.
      if (caminho.pathname.includes('/lib/i18n/')) return []
      return [readFileSync(caminho, 'utf8')]
    })
  }

  it('toda chave traduzida é usada em algum lugar do código', () => {
    // Chave morta é string que alguém traduziu duas vezes para ninguém ler —
    // e some do radar justamente porque o tipo garante que ela "existe".
    const codigo = arquivosDeCodigo(new URL('../../', import.meta.url)).join('\n')
    const orfas = Object.keys(pt).filter((chave) => !codigo.includes(`'${chave}'`))

    expect(orfas).toEqual([])
  })
})

describe('nomes com trocadilho próprio (core, 14)', () => {
  const NOMES = [
    'inimigo.casquinha',
    'inimigo.minhoca',
    'inimigo.rosquinha',
    'inimigo.pirulito',
    'inimigo.pudim',
    'mundo.bioma1',
  ] as const

  it('não repete o texto em português', () => {
    for (const chave of NOMES) {
      expect(en[chave]).not.toBe(pt[chave])
    }
  })

  it('não usa a tradução literal que um tradutor automático devolveria', () => {
    const LITERAIS: Record<(typeof NOMES)[number], string[]> = {
      'inimigo.casquinha': ['Little Cone', 'Small Cone', 'Ice Cream Cone'],
      'inimigo.minhoca': ['Sour Worm', 'Sour Earthworm'],
      'inimigo.rosquinha': ['Brute Donut', 'Bully Donut', 'Little Donut'],
      'inimigo.pirulito': ['Bully Lollipop', 'Lollipop Bully'],
      'inimigo.pudim': ['Resigned Pudding', 'Conformed Pudding'],
      'mundo.bioma1': ['Cotton Candy Forest'],
    }

    for (const chave of NOMES) {
      expect(LITERAIS[chave]).not.toContain(en[chave])
    }
  })
})

describe('detecção de idioma pelo navegador', () => {
  it('reconhece qualquer variante de português', () => {
    expect(detectarIdioma(['pt-BR', 'en-US'])).toBe('pt')
    expect(detectarIdioma(['pt-PT'])).toBe('pt')
  })

  it('cai em inglês quando o idioma não é suportado', () => {
    expect(detectarIdioma(['ja-JP', 'ko-KR'])).toBe('en')
    expect(detectarIdioma([])).toBe('en')
  })

  it('respeita a ordem de preferência do navegador', () => {
    expect(detectarIdioma(['en-GB', 'pt-BR'])).toBe('en')
    expect(detectarIdioma(['pt-BR', 'en-GB'])).toBe('pt')
  })
})

describe('interpolação', () => {
  it('substitui todos os placeholders nas duas línguas', () => {
    expect(traduzir('pt', 'hud.xpParaProximo', { atual: '10', alvo: '100' })).toBe('10 / 100 XP')
    expect(traduzir('en', 'retorno.xpGanho', { valor: '2,4 mil' })).toBe('+2,4 mil XP')
  })
})
