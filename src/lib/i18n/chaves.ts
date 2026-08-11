import { pt } from './pt'

/**
 * O conjunto de chaves de tradução do jogo, derivado do dicionário português.
 *
 * Qualquer outro idioma é tipado como `Record<ChaveI18n, string>`, então uma
 * chave nova sem tradução correspondente vira erro de compilação — não uma
 * string faltando descoberta em produção.
 */
export type ChaveI18n = keyof typeof pt

/** Os idiomas em que o jogo lança (core, critério 13). */
export const IDIOMAS = ['pt', 'en'] as const
export type Idioma = (typeof IDIOMAS)[number]

export function ehIdiomaSuportado(valor: string): valor is Idioma {
  return (IDIOMAS as readonly string[]).includes(valor)
}
