import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { TOKENS_BIOMA, TOKENS_PALETA } from '../game/paleta'
import { RARIDADES } from '../game/regrasLoot'

// `tokens.css` é declarado fonte única da paleta, e o canvas lê os mesmos
// custom properties em runtime (`paleta.ts`). "Fonte única" só é verdade se
// alguém verificar — este arquivo é esse alguém.

const RAIZ_SRC = new URL('../', import.meta.url)
const tokensCss = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

/** Todo `--nome:` declarado em tokens.css. */
function tokensDeclarados(): Set<string> {
  return new Set([...tokensCss.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]!))
}

/** Todo arquivo `.css` de `src/`, recursivamente. */
function arquivosCss(pasta = RAIZ_SRC): URL[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = new URL(entrada.name + (entrada.isDirectory() ? '/' : ''), pasta)
    if (entrada.isDirectory()) return arquivosCss(caminho)
    return entrada.name.endsWith('.css') ? [caminho] : []
  })
}

describe('tokens.css é mesmo a fonte única da paleta', () => {
  it('declara todo token que o canvas vai ler', () => {
    // `paleta.ts` estoura `PaletaAusenteError` se um token de marca faltar — o
    // que seria uma tela de erro para o jogador. Melhor reprovar o build.
    const declarados = tokensDeclarados()
    for (const token of TOKENS_PALETA) {
      expect(declarados.has(token), `${token} não está em tokens.css`).toBe(true)
    }
    for (const token of TOKENS_BIOMA) {
      expect(declarados.has(token), `${token} não está em tokens.css`).toBe(true)
    }
  })

  it('declara uma cor para cada um dos 10 tiers de raridade', () => {
    const declarados = tokensDeclarados()
    for (const raridade of RARIDADES) {
      expect(declarados.has(`--raridade-${raridade}`), `falta --raridade-${raridade}`).toBe(true)
    }
  })

  it('nenhum CSS usa um token que não existe', () => {
    // Um `var(--cor-primária)` com acento, ou um token renomeado pela metade,
    // não quebra nada: o navegador simplesmente não pinta. É o tipo de defeito
    // que só aparece se alguém olhar a tela certa.
    const declarados = tokensDeclarados()
    const problemas: string[] = []

    for (const arquivo of arquivosCss()) {
      const conteudo = readFileSync(arquivo, 'utf8')
      const proprios = new Set([...conteudo.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]!))

      for (const uso of conteudo.matchAll(/var\((--[a-z0-9-]+)/gi)) {
        const token = uso[1]!
        if (!declarados.has(token) && !proprios.has(token)) {
          problemas.push(`${arquivo.pathname.split('/src/')[1]}: ${token}`)
        }
      }
    }

    expect(problemas).toEqual([])
  })

  it('nenhum hex solto fora de tokens.css', () => {
    // A regra que o CLAUDE.md e o design system já afirmam. Vale para CSS e
    // para TypeScript: uma cor escrita duas vezes é uma cor que vai divergir.
    const problemas: string[] = []

    for (const arquivo of arquivosCss()) {
      if (arquivo.pathname.endsWith('tokens.css')) continue
      const conteudo = readFileSync(arquivo, 'utf8')
      for (const hex of conteudo.matchAll(/#[0-9a-f]{3,8}\b/gi)) {
        problemas.push(`${arquivo.pathname.split('/src/')[1]}: ${hex[0]}`)
      }
    }

    expect(problemas).toEqual([])
  })
})

describe('a marca não diverge da paleta', () => {
  it('a cor de tema do index.html é a mesma --cor-fundo', () => {
    // O `<meta name="theme-color">` é lido pelo navegador antes de qualquer
    // CSS, então precisa repetir o hex — e é exatamente por isso que ele pode
    // envelhecer em silêncio quando a paleta muda. Aconteceu na migração para a
    // paleta endurecida; este teste é o que impede a segunda vez.
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
    const tema = html.match(/name="theme-color"\s+content="(#[0-9a-f]{3,8})"/i)?.[1]
    const fundo = tokensCss.match(/--cor-fundo:\s*(#[0-9a-f]{3,8})/i)?.[1]

    expect(tema, 'index.html não declara theme-color').toBeTruthy()
    expect(fundo, 'tokens.css não declara --cor-fundo').toBeTruthy()
    expect(tema!.toLowerCase()).toBe(fundo!.toLowerCase())
  })
})
