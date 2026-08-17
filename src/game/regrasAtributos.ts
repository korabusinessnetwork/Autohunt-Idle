// Regras de atributo — espelho em TypeScript do que roda no Postgres.
//
// Como em `regrasFarm.ts`, nada aqui decide o estado do jogador: quem grava
// atributo e ponto é a RPC `SECURITY DEFINER`. Isto serve para a UI mostrar
// custo e prévia antes de mandar, e como documentação executável da regra.
//
// A regra de custo vem de `specs/ranking-global.md`, critério 11. A prosa da
// spec e a fórmula dela discordavam em uma unidade; o critério 12 desempata com
// um exemplo ("subir de 10 pra 11 custou 2 pontos"), e é a fórmula que vale.

/**
 * Os cinco atributos, na ordem em que a tela os lista.
 *
 * `forca` PRECISA vir antes de `destreza`: o andaime `distribuir` dos testes
 * gasta saldo sempre no primeiro atributo empatado em menor nível, então a
 * ordem desta lista é o que decide para onde vai o ponto quando todos valem o
 * mesmo — e há teste ancorado nesse desempate.
 *
 * Os três primeiros são os canais de dano, na ordem de `TipoDano`
 * (`lib/tipos.ts`); vitalidade e sorte são de suporte e fecham a lista.
 */
export const ATRIBUTOS = ['forca', 'destreza', 'inteligencia', 'vitalidade', 'sorte'] as const

export type Atributo = (typeof ATRIBUTOS)[number]
export type Atributos = Record<Atributo, number>

/**
 * Pontos concedidos a cada level up.
 *
 * Era 3, virou 1 em 2026-08-13, por decisão do dono. Com 3, subir de nível
 * pagava um atributo inteiro e a escolha não pesava; com 1, cada ponto é uma
 * decisão. O custo por nível de atributo (`custoDoProximoNivel`) não mudou —
 * então a partir do décimo ponto num mesmo atributo o preço dobra, e
 * especializar passa a custar caro de verdade.
 */
export const PONTOS_POR_NIVEL = 1

/**
 * A alocação vazia — e a forma recomendada de fabricar qualquer alocação
 * (`{ ...atributosZerados(), forca: 10 }`), inclusive em teste.
 *
 * O literal é escrito à mão de propósito: como o retorno é tipado `Atributos`,
 * acrescentar um atributo à lista acima e esquecer esta linha é erro de `tsc`,
 * não bug de runtime. `Object.fromEntries` compilaria com a chave faltando.
 */
export function atributosZerados(): Atributos {
  return { forca: 0, destreza: 0, inteligencia: 0, vitalidade: 0, sorte: 0 }
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

// A auto-alocação morava aqui: distribuía os pontos sozinha, sempre no atributo
// de menor nível, para que quem nunca abrisse esta tela jogasse com uma build
// coerente. Saiu do jogo em 2026-08-13 — ver o cabeçalho de
// `supabase/migrations/20260829_atributos_manuais.sql`. Quem gasta ponto é o
// jogador; o Princípio nº1 passou a ser atendido pelo selo de pontos livres no
// ícone de atributos, que avisa sem exigir leitura.

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
