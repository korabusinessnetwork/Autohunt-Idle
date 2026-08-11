// Regras de loot — a parte pura, espelhada no Postgres.
//
// Diferente de `regrasFarm.ts`, aqui o client NÃO tem espelho do sorteio: quem
// sorteia é o servidor, e o resultado chega pronto. O que está espelhado e
// testado é a **escalada de raridade a partir de sorteios já feitos** — a
// lógica que decide até onde um drop sobe. O SQL alimenta essa mesma lógica com
// sorteios derivados de `md5(player_id || contador)`, que são determinísticos
// (auditáveis, reproduzíveis) e fora do alcance do jogador, que não controla
// nem o id nem o contador.

export const RARIDADES = [
  'comum',
  'incomum',
  'raro',
  'epico',
  'lendario',
  'caramelizado',
  'glaceado',
  'dourado',
  'cristalizado',
  'cosmico',
] as const

export type Raridade = (typeof RARIDADES)[number]

/** Tier mínimo e máximo, 1-indexados como no banco. */
export const TIER_MINIMO = 1
export const TIER_MAXIMO = RARIDADES.length

export function nomeDaRaridade(tier: number): Raridade {
  const indice = Math.min(TIER_MAXIMO, Math.max(TIER_MINIMO, Math.trunc(tier))) - 1
  return RARIDADES[indice]!
}

/** Chance base de subir um degrau de raridade num drop. */
const CHANCE_BASE_DE_SUBIR = 0.18
/** Quanto de Sorte vale um ponto percentual a mais de chance. */
const SORTE_POR_PONTO = 40
/** Teto do bônus de Sorte — investir muito ajuda, mas nunca torna trivial. */
const BONUS_MAXIMO_DE_SORTE = 0.12

/**
 * Chance de subir um degrau, já com o bônus de Sorte.
 *
 * O teto existe para o critério 3 do spec: Sorte melhora as probabilidades sem
 * transformar tier alto em rotina.
 */
export function chanceDeSubir(sorte: number): number {
  const bonus = Math.min(BONUS_MAXIMO_DE_SORTE, Math.max(0, sorte) / (SORTE_POR_PONTO * 100))
  return CHANCE_BASE_DE_SUBIR + bonus
}

export interface FaixaDeRaridade {
  /** Tier garantido — o drop nunca sai abaixo disto. */
  piso: number
  /** Tier máximo alcançável nesta fonte. */
  teto: number
}

/**
 * Resolve o tier de um drop a partir de sorteios já realizados.
 *
 * Começa no piso e sobe um degrau por sorteio bem-sucedido, parando no primeiro
 * fracasso, no teto da fonte ou no tier máximo do jogo.
 *
 * O piso é **garantia, não sorteio** — é o que faz o boss de dungeon cumprir o
 * critério 11 ("mínimo raro, certeza, não só chance").
 */
export function escalarRaridade(
  faixa: FaixaDeRaridade,
  sorte: number,
  sorteios: readonly number[],
): number {
  const piso = Math.min(TIER_MAXIMO, Math.max(TIER_MINIMO, faixa.piso))
  const teto = Math.min(TIER_MAXIMO, Math.max(piso, faixa.teto))
  const chance = chanceDeSubir(sorte)

  let tier = piso
  for (const sorteio of sorteios) {
    if (tier >= teto) break
    if (sorteio >= chance) break
    tier += 1
  }

  return tier
}

// --- Faixas por fonte de loot -----------------------------------------------

/** Mundo aberto: comum, com chance de subir. */
export const FAIXA_MUNDO: FaixaDeRaridade = { piso: 1, teto: TIER_MAXIMO }

/**
 * Mini boss: degrau do meio — incomum garantido, raro no máximo
 * (`specs/dungeons-loot-skins.md`, critério 1b).
 */
export const FAIXA_MINI_BOSS: FaixaDeRaridade = { piso: 2, teto: 3 }

/** Boss de dungeon derrotado: raro garantido, sem teto acima disso. */
export const FAIXA_BOSS: FaixaDeRaridade = { piso: 3, teto: TIER_MAXIMO }

/** Dungeon perdida: a chave foi gasta, mas não há piso garantido. */
export const FAIXA_DUNGEON_PERDIDA: FaixaDeRaridade = { piso: 1, teto: 3 }

// --- Síntese ----------------------------------------------------------------

/** Quantos itens iguais uma síntese consome. */
export const ITENS_POR_SINTESE = 9

/** Chance de a síntese pular um nível (critério 17 do spec de build). */
export const CHANCE_DE_PULAR_NIVEL = 0.08

export type ErroSintese = 'ITENS_INSUFICIENTES' | 'TIER_MAXIMO' | 'TIPO_INVALIDO'

/**
 * Resultado de uma síntese, dado quantos itens existem e um sorteio.
 *
 * Pura de propósito: é a regra que precisa provar que a conta fecha — 9 entram,
 * 1 sai, nunca some sem gerar nem gera sem consumir.
 */
export function resolverSintese(
  raridade: number,
  disponiveis: number,
  sorteio: number,
): { ok: true; consome: number; produzRaridade: number } | { ok: false; erro: ErroSintese } {
  if (raridade >= TIER_MAXIMO) return { ok: false, erro: 'TIER_MAXIMO' }
  if (disponiveis < ITENS_POR_SINTESE) return { ok: false, erro: 'ITENS_INSUFICIENTES' }

  const pulou = sorteio < CHANCE_DE_PULAR_NIVEL
  const produz = Math.min(TIER_MAXIMO, raridade + (pulou ? 2 : 1))

  return { ok: true, consome: ITENS_POR_SINTESE, produzRaridade: produz }
}
