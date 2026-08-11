// Regras de atributo — espelho em TypeScript do que roda no Postgres.
//
// Como em `regrasFarm.ts`, nada aqui decide o estado do jogador: quem grava
// atributo e ponto é a RPC `SECURITY DEFINER`. Isto serve para a UI mostrar
// custo e prévia antes de mandar, e como documentação executável da regra.
//
// A regra de custo vem de `specs/ranking-global.md`, critério 11. A prosa da
// spec e a fórmula dela discordavam em uma unidade; o critério 12 desempata com
// um exemplo ("subir de 10 pra 11 custou 2 pontos"), e é a fórmula que vale.

export const ATRIBUTOS = ['forca', 'inteligencia', 'vitalidade', 'sorte'] as const

export type Atributo = (typeof ATRIBUTOS)[number]
export type Atributos = Record<Atributo, number>

/** Pontos concedidos a cada level up. */
export const PONTOS_POR_NIVEL = 3

export function atributosZerados(): Atributos {
  return { forca: 0, inteligencia: 0, vitalidade: 0, sorte: 0 }
}

/** Total de pontos que um jogador daquele nível já ganhou na vida. */
export function pontosGanhosAte(nivel: number): number {
  return Math.max(0, nivel - 1) * PONTOS_POR_NIVEL
}

/** Custo de subir um atributo do nível `atual` para `atual + 1`. */
export function custoDoProximoNivel(atual: number): number {
  return 1 + Math.floor(atual / 10)
}

/**
 * Custo acumulado de levar um atributo de 0 até `nivel`.
 *
 * Fechado em vez de somatório: com nível sem teto (core, 12), um jogador
 * antigo pode ter milhares de níveis de atributo, e isto roda a cada respec.
 */
export function custoAcumulado(nivel: number): number {
  if (nivel <= 0) return 0
  const dezenas = Math.floor(nivel / 10)
  const resto = nivel % 10
  return nivel + 5 * dezenas * (dezenas - 1) + dezenas * resto
}

/** Custo total de uma alocação inteira. */
export function custoTotalDaAlocacao(atributos: Atributos): number {
  return ATRIBUTOS.reduce((total, chave) => total + custoAcumulado(atributos[chave]), 0)
}

/**
 * Qual atributo recebe o próximo ponto na auto-alocação.
 *
 * O de menor nível, com desempate na ordem declarada em `ATRIBUTOS`. Como o
 * custo cresce com o nível, o menor é sempre também o mais barato — então, se
 * ele não couber no saldo, nenhum outro caberia.
 */
export function proximoAlvoDaAutoAlocacao(atributos: Atributos): Atributo {
  let alvo: Atributo = ATRIBUTOS[0]
  for (const chave of ATRIBUTOS) {
    if (atributos[chave] < atributos[alvo]) alvo = chave
  }
  return alvo
}

export interface ResultadoAlocacao {
  atributos: Atributos
  pontosRestantes: number
}

/**
 * Distribui pontos automaticamente, de forma balanceada.
 *
 * É o que faz o Princípio nº1 valer aqui: quem nunca abrir a tela de atributos
 * joga com uma build coerente, sem precisar entender o sistema.
 */
export function autoAlocar(atuais: Atributos, pontosDisponiveis: number): ResultadoAlocacao {
  const atributos = { ...atuais }
  let pontos = Math.max(0, pontosDisponiveis)

  for (;;) {
    const alvo = proximoAlvoDaAutoAlocacao(atributos)
    const custo = custoDoProximoNivel(atributos[alvo])
    if (custo > pontos) break
    pontos -= custo
    atributos[alvo] += 1
  }

  return { atributos, pontosRestantes: pontos }
}

export type ErroAlocacao = 'ATRIBUTO_INVALIDO' | 'PONTOS_INSUFICIENTES'

/**
 * Valida uma realocação pedida pelo jogador.
 *
 * O respec é livre e sem penalidade (critério 10 da spec de origem), então não
 * há nada a cobrar — só a conferir que a conta fecha. Devolver o custo real de
 * cada nível (critério 12) sai de graça: como a validação compara o custo
 * ACUMULADO da alocação nova com os pontos ganhos na vida, nenhum ponto é
 * criado nem destruído no caminho.
 */
export function validarAlocacao(
  atributos: Atributos,
  nivel: number,
): { valida: true } | { valida: false; erro: ErroAlocacao } {
  for (const chave of ATRIBUTOS) {
    const valor = atributos[chave]
    if (!Number.isInteger(valor) || valor < 0) return { valida: false, erro: 'ATRIBUTO_INVALIDO' }
  }

  const custo = custoTotalDaAlocacao(atributos)
  if (custo > pontosGanhosAte(nivel)) return { valida: false, erro: 'PONTOS_INSUFICIENTES' }

  return { valida: true }
}

/** Pontos que sobram depois de uma alocação. */
export function pontosDisponiveis(atributos: Atributos, nivel: number): number {
  return pontosGanhosAte(nivel) - custoTotalDaAlocacao(atributos)
}
