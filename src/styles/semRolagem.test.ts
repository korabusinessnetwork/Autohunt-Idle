import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

// "Nenhum menu rola" é regra de produto, não preferência de layout.
//
// Decisão do dono em 2026-08-13: todo painel do jogo cabe numa tela só, sem
// barra de rolagem. É a mesma ideia do Princípio nº1 — o jogador casual não
// deveria precisar descobrir que existe conteúdo escondido abaixo da dobra de
// um menu. O que não cabe vira PÁGINA (`components/shared/ListaPaginada.tsx`)
// ou vira LARGURA (uma grade em vez de uma pilha).
//
// Uma regra assim volta sozinha no primeiro `overflow-y: auto` distraído de
// quem só queria "resolver o corte". Este arquivo é o que impede a volta.

const RAIZ_SRC = new URL('../', import.meta.url)

/**
 * O console de ajuste é a ÚNICA exceção, e é consciente: não é tela de jogador,
 * é ferramenta de dono para varrer dezenas de números e o rastro de auditoria.
 * Paginar uma auditoria atrapalha exatamente quem a usa.
 */
const FORA_DA_REGRA = ['features/console/']

/** Todo arquivo `.css` de `src/`, recursivamente. */
function arquivosCss(pasta = RAIZ_SRC): URL[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = new URL(entrada.name + (entrada.isDirectory() ? '/' : ''), pasta)
    if (entrada.isDirectory()) return arquivosCss(caminho)
    return entrada.name.endsWith('.css') ? [caminho] : []
  })
}

function relativo(arquivo: URL): string {
  return arquivo.pathname.split('/src/')[1]!
}

/** Sem comentários: um `/* overflow-y: auto *\/` explicando a regra não a viola. */
function semComentarios(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

describe('nenhum menu rola', () => {
  it('nenhum CSS de tela do jogador declara rolagem', () => {
    const problemas: string[] = []

    for (const arquivo of arquivosCss()) {
      const caminho = relativo(arquivo)
      if (FORA_DA_REGRA.some((prefixo) => caminho.startsWith(prefixo))) continue

      const css = semComentarios(readFileSync(arquivo, 'utf8'))
      for (const uso of css.matchAll(/overflow(-x|-y)?\s*:\s*(auto|scroll|overlay)/gi)) {
        problemas.push(`${caminho}: ${uso[0]}`)
      }
    }

    expect(problemas).toEqual([])
  })

  it('todo cartão de painel tem teto de altura', () => {
    // Sem teto, o cartão simplesmente vaza para fora da tela — que é pior que
    // rolagem, porque aí o conteúdo não tem NENHUM jeito de ser alcançado.
    // Todo overlay (`position: fixed`) precisa que seu cartão declare `height`
    // ou `max-height`.
    const problemas: string[] = []

    for (const arquivo of arquivosCss()) {
      const caminho = relativo(arquivo)
      if (FORA_DA_REGRA.some((prefixo) => caminho.startsWith(prefixo))) continue

      const css = semComentarios(readFileSync(arquivo, 'utf8'))
      if (!/position\s*:\s*fixed/i.test(css)) continue
      if (!/__cartao\s*\{/.test(css)) continue

      const cartao = css.match(/__cartao\s*\{([^}]*)\}/)?.[1] ?? ''
      if (!/(^|[\s;])(max-)?height\s*:/i.test(cartao)) {
        problemas.push(`${caminho}: __cartao sem height nem max-height`)
      }
    }

    expect(problemas).toEqual([])
  })
})
