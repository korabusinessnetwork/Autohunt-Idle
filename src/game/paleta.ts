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

export type TokenPaleta = (typeof TOKENS_PALETA)[number]
export type Paleta = Record<TokenPaleta, string>

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

  return paleta
}
