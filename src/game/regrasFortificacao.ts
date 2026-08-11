// Regras de fortificação — espelho puro do que roda no Postgres.
//
// Decisões de produto que este arquivo materializa
// (`specs/fortificacao-de-item.md`, decidida pelo dono em 2026-08-11):
//
//   · custa OURO, nunca diamante. A loja que vende ouro por diamante entra
//     quando o diamante existir, e a compra lá é de quantidade fixa — a compra
//     nunca é o sorteio. É isso que separa esta mecânica de uma caixa aleatória
//     paga, não o degrau a mais na cadeia;
//   · as pedras SÓ CAEM JOGANDO. Nenhuma é vendida, por moeda nenhuma;
//   · falhar consome o material e NÃO mexe no item. Não existe função aqui que
//     reduza o nível de fortificação — "progresso nunca é punido"
//     (`memory/identity.md`) segue valendo sem exceção.

/** Teto de fortificação. A chance chega ao piso bem antes disso. */
export const FORTIFICACAO_MAXIMA = 15

const CHANCE_INICIAL = 0.95
const QUEDA_POR_NIVEL = 0.075
/** Piso: os últimos degraus são troféu de longo prazo, não progressão esperada. */
const CHANCE_MINIMA = 0.05
/** Quanto a Pedra da Sorte acrescenta à chance da tentativa. */
export const BONUS_PEDRA_SORTE = 0.15
/** Quanto cada nível de fortificação acrescenta ao stat do item. */
const BONUS_POR_NIVEL = 0.08

export type Pedra = 'pedra_fortificacao' | 'pedra_sorte' | 'pedra_garantia'

export const PEDRAS: readonly Pedra[] = [
  'pedra_fortificacao',
  'pedra_sorte',
  'pedra_garantia',
]

/**
 * Chance de a tentativa dar certo, partindo do nível atual.
 *
 * Cai a cada degrau e nunca sobe — é o que faz `+15` significar alguma coisa.
 */
export function chanceDeSucesso(nivelAtual: number, comPedraDaSorte = false): number {
  const nivel = Math.max(0, Math.trunc(nivelAtual))
  const base = Math.max(CHANCE_MINIMA, CHANCE_INICIAL - nivel * QUEDA_POR_NIVEL)
  const comBonus = comPedraDaSorte ? base + BONUS_PEDRA_SORTE : base
  return Math.min(CHANCE_INICIAL, comBonus)
}

/**
 * Custo em ouro da tentativa.
 *
 * Cresce com o nível e com a raridade: fortificar um item cósmico é caro
 * porque vale muito mais (ver `bonusDeFortificacao`).
 */
export function custoEmOuro(nivelAtual: number, raridade: number): number {
  const nivel = Math.max(0, Math.trunc(nivelAtual))
  const tier = Math.min(10, Math.max(1, Math.trunc(raridade)))
  return Math.floor(50 * (nivel + 1) ** 2 * (1 + tier / 5))
}

/** Multiplicador que a fortificação aplica ao stat do item. */
export function bonusDeFortificacao(nivel: number): number {
  return 1 + Math.min(FORTIFICACAO_MAXIMA, Math.max(0, Math.trunc(nivel))) * BONUS_POR_NIVEL
}

export type ErroFortificacao =
  | 'TETO_ATINGIDO'
  | 'OURO_INSUFICIENTE'
  | 'SEM_PEDRA'
  | 'ITEM_NAO_FORTIFICAVEL'

export interface PedidoFortificacao {
  nivelAtual: number
  raridade: number
  ouroDisponivel: number
  pedrasFortificacao: number
  usarPedraSorte: boolean
  pedrasSorte: number
  usarPedraGarantia: boolean
  pedrasGarantia: number
}

export type ResultadoValidacao =
  | { ok: true; custo: number; chance: number }
  | { ok: false; erro: ErroFortificacao }

/**
 * Valida a tentativa antes de gastar qualquer coisa.
 *
 * Recusa cedo é o que garante o critério 10: faltando ouro ou pedra, nada é
 * consumido.
 */
export function validarFortificacao(pedido: PedidoFortificacao): ResultadoValidacao {
  if (pedido.nivelAtual >= FORTIFICACAO_MAXIMA) return { ok: false, erro: 'TETO_ATINGIDO' }
  if (pedido.pedrasFortificacao < 1) return { ok: false, erro: 'SEM_PEDRA' }
  if (pedido.usarPedraSorte && pedido.pedrasSorte < 1) return { ok: false, erro: 'SEM_PEDRA' }
  if (pedido.usarPedraGarantia && pedido.pedrasGarantia < 1) return { ok: false, erro: 'SEM_PEDRA' }

  const custo = custoEmOuro(pedido.nivelAtual, pedido.raridade)
  if (pedido.ouroDisponivel < custo) return { ok: false, erro: 'OURO_INSUFICIENTE' }

  return {
    ok: true,
    custo,
    chance: pedido.usarPedraGarantia ? 1 : chanceDeSucesso(pedido.nivelAtual, pedido.usarPedraSorte),
  }
}

/**
 * Resolve a tentativa a partir de um sorteio já feito.
 *
 * Repare no que NÃO existe aqui: nenhum caminho devolve um nível menor que o
 * de entrada. Falhar mantém o item exatamente como estava.
 */
export function resolverFortificacao(
  nivelAtual: number,
  chance: number,
  sorteio: number,
): { sucesso: boolean; nivelFinal: number } {
  const sucesso = sorteio < chance
  return {
    sucesso,
    nivelFinal: sucesso ? Math.min(FORTIFICACAO_MAXIMA, nivelAtual + 1) : nivelAtual,
  }
}
