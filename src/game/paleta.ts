// Ponte entre os tokens CSS e o canvas.
//
// O canvas não entende `var(--cor-primaria)`, então lê o valor computado uma
// vez na inicialização. É o que permite `src/styles/tokens.css` ser a única
// fonte da paleta — nenhum hex é repetido em TypeScript.

export const TOKENS_PALETA = [
  '--cor-primaria',
  '--cor-secundaria',
  '--cor-recompensa',
  '--cor-positivo',
  '--cor-bloqueado',
  '--cor-fundo',
  '--cor-texto',
] as const

/**
 * Os três papéis de cor de cada um dos 8 biomas. Gerados a partir do índice em
 * vez de escritos à mão: uma lista literal de 24 nomes daria margem a um token
 * existir no CSS e faltar aqui, ou o contrário.
 */
export const TOKENS_BIOMA = Array.from({ length: 8 }, (_, i) => i + 1).flatMap(
  (n) => [`--bioma-${n}-fundo`, `--bioma-${n}-detalhe`, `--bioma-${n}-assinatura`] as const,
)

export type TokenPaleta = (typeof TOKENS_PALETA)[number]
export type TokenBioma = string
export type Paleta = Record<TokenPaleta, string> & Record<TokenBioma, string>

export class PaletaAusenteError extends Error {
  readonly codigo = 'PALETA_AUSENTE'
  constructor(token: string) {
    super(`Token ${token} não encontrado — src/styles/tokens.css não foi carregado.`)
  }
}

/** Lê a paleta dos custom properties do elemento raiz. */
export function lerPaleta(elemento: Element): Paleta {
  const estilo = getComputedStyle(elemento)
  const paleta = {} as Paleta

  for (const token of TOKENS_PALETA) {
    const valor = estilo.getPropertyValue(token).trim()
    if (!valor) throw new PaletaAusenteError(token)
    paleta[token] = valor
  }

  // Token de bioma ausente não derruba o jogo: cai para a cor de marca
  // equivalente. Um cenário com a cor errada é infinitamente melhor que a tela
  // de erro — e a ausência aparece no teste, não para o jogador.
  for (const token of TOKENS_BIOMA) {
    const valor = estilo.getPropertyValue(token).trim()
    paleta[token] = valor || paleta['--cor-secundaria']
  }

  return paleta
}
