import { obterArmazenamento } from '../armazenamento'
import { ehIdiomaSuportado, type ChaveI18n, type Idioma } from './chaves'
import { en } from './en'
import { pt } from './pt'

export type { ChaveI18n, Idioma }
export { IDIOMAS, ehIdiomaSuportado } from './chaves'

const DICIONARIOS: Record<Idioma, Record<ChaveI18n, string>> = { pt, en }

const CHAVE_ARMAZENAMENTO = 'autohunt.idioma'

/**
 * Detecta o idioma pelo navegador (core, 13). Qualquer variante de português
 * (pt-BR, pt-PT) cai em `pt`; todo o resto cai em `en`, que é o idioma de
 * alcance maior nos portais internacionais.
 */
export function detectarIdioma(idiomasDoNavegador: readonly string[]): Idioma {
  for (const bruto of idiomasDoNavegador) {
    const base = bruto.toLowerCase().split('-')[0]
    if (base && ehIdiomaSuportado(base)) return base
  }
  return 'en'
}

/** Preferência manual do jogador vence a detecção automática. */
export function idiomaInicial(): Idioma {
  if (typeof window === 'undefined') return 'pt'

  const salvo = obterArmazenamento().getItem(CHAVE_ARMAZENAMENTO)
  if (salvo && ehIdiomaSuportado(salvo)) return salvo
  return detectarIdioma(window.navigator?.languages ?? [window.navigator?.language ?? 'en'])
}

export function salvarIdioma(idioma: Idioma): void {
  if (typeof window === 'undefined') return

  obterArmazenamento().setItem(CHAVE_ARMAZENAMENTO, idioma)
  window.document?.documentElement?.setAttribute('lang', idioma)
}

/**
 * Traduz uma chave, interpolando `{placeholders}`.
 *
 * Sem fallback silencioso para outro idioma: se a chave existe no tipo, existe
 * nos dois dicionários — é isso que o tipo garante.
 */
export function traduzir(
  idioma: Idioma,
  chave: ChaveI18n,
  valores?: Record<string, string | number>,
): string {
  let texto: string = DICIONARIOS[idioma][chave]
  if (valores) {
    for (const [nome, valor] of Object.entries(valores)) {
      texto = texto.replaceAll(`{${nome}}`, String(valor))
    }
  }
  return texto
}

/** Fábrica de `t` já amarrada a um idioma — o que os componentes consomem. */
export function criarTradutor(idioma: Idioma) {
  return (chave: ChaveI18n, valores?: Record<string, string | number>) =>
    traduzir(idioma, chave, valores)
}

export type Tradutor = ReturnType<typeof criarTradutor>
