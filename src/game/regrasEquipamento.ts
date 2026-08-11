// Regras de equipamento — espelho puro do que roda no Postgres.
//
// A variedade do jogo vem do LOOT, não de uma escolha inicial: não existe
// classe em lugar nenhum (`specs/equipamento-e-poder.md`, critério 1). "Build
// de mago" é uma identidade que emerge de varinha mais peças mágicas, e some no
// instante em que o jogador troca de arma.
//
// Skin não aparece em nenhuma função deste arquivo, de propósito: é assim que
// "skin nunca tem stat" deixa de ser promessa e vira propriedade estrutural.

import type { Atributos } from './regrasAtributos'

export type TipoDano = 'fisico' | 'magico'

/**
 * Os seis slots que contribuem para o poder, um por parte do corpo
 * (`specs/build-fase-3d-slots-por-parte.md`).
 *
 * `skin` NÃO está aqui — e é essa ausência que faz o cosmético ser cosmético.
 */
export const SLOTS_DE_PODER = [
  'arma',
  'capacete',
  'armadura',
  'luva',
  'bota',
  'acessorio',
] as const

export type SlotDePoder = (typeof SLOTS_DE_PODER)[number]

export interface ItemEquipado {
  raridade: number
  /** Só a arma carrega tipo de dano. */
  tipoDano?: TipoDano | null
  /** Qualquer peça que não seja a arma pode ter afinidade. */
  afinidade?: TipoDano | null
  /** Só item épico ou superior pertence a conjunto. */
  conjuntoId?: string | null
}

export type Loadout = Partial<Record<SlotDePoder, ItemEquipado | null>>

/** Quanto stat um item rende, em função da raridade. */
export function poderDoItem(raridade: number): number {
  const tier = Math.min(10, Math.max(0, Math.trunc(raridade)))
  // Cresce mais que linear: cósmico precisa parecer cósmico.
  return tier * tier + tier * 3
}

/** Bônus que uma peça ganha quando a afinidade dela bate com a arma. */
const BONUS_DE_SINERGIA = 0.2

/**
 * Degraus de conjunto. Com seis slots, "completo" são seis peças — então
 * precisa de um degrau no meio, senão o salto de 2 para 6 fica sem nada entre.
 *
 * Cada degrau vale MAIS QUE O DOBRO do anterior: 0.20 > 2 × 0.08 e
 * 0.45 > 2 × 0.20. É a garantia do critério 16 da spec de origem, generalizada.
 */
const DEGRAUS_DE_CONJUNTO: readonly { pecas: number; bonus: number }[] = [
  { pecas: 6, bonus: 0.45 },
  { pecas: 4, bonus: 0.2 },
  { pecas: 2, bonus: 0.08 },
]

function pecasEquipadas(loadout: Loadout): ItemEquipado[] {
  return SLOTS_DE_PODER.map((slot) => loadout[slot]).filter(
    (item): item is ItemEquipado => Boolean(item),
  )
}

/** Quantas peças do conjunto mais representado o loadout tem. */
export function pecasDoMaiorConjunto(loadout: Loadout): {
  conjuntoId: string | null
  pecas: number
} {
  const contagem = new Map<string, number>()

  for (const item of pecasEquipadas(loadout)) {
    if (!item.conjuntoId) continue
    contagem.set(item.conjuntoId, (contagem.get(item.conjuntoId) ?? 0) + 1)
  }

  let melhor: string | null = null
  let pecas = 0
  for (const [id, quantidade] of contagem) {
    if (quantidade > pecas) {
      melhor = id
      pecas = quantidade
    }
  }

  return { conjuntoId: melhor, pecas }
}

/**
 * Multiplicador de conjunto.
 *
 * Só o conjunto mais representado conta: peças de conjuntos diferentes não
 * empilham bônus parcial (critério 16 da spec de origem).
 */
export function multiplicadorDeConjunto(loadout: Loadout): number {
  const { pecas } = pecasDoMaiorConjunto(loadout)
  const degrau = DEGRAUS_DE_CONJUNTO.find((d) => pecas >= d.pecas)
  return 1 + (degrau?.bonus ?? 0)
}

export interface DetalhePoder {
  /** Contribuição da arma. */
  arma: number
  /** Contribuição somada das outras peças, já com sinergia. */
  pecas: number
  /** Contribuição dos atributos, já ponderada pelo tipo de dano da arma. */
  atributos: number
  multiplicadorConjunto: number
  /** Quantas peças tiveram a afinidade batendo com a arma. */
  pecasEmSinergia: number
  total: number
}

/**
 * Poder de ataque a partir do loadout e dos atributos.
 *
 * Força escala dano físico e Inteligência escala dano mágico (critério 12 da
 * spec de origem): o atributo que casa com a arma conta inteiro, o outro conta
 * pela metade — o suficiente para uma build auto-alocada continuar viável sem
 * apagar a diferença de quem monta o loadout de propósito.
 */
export function calcularPoderDeAtaque(loadout: Loadout, atributos: Atributos): DetalhePoder {
  const arma = loadout.arma ?? null
  const tipoDano: TipoDano = arma?.tipoDano ?? 'fisico'

  const principal = tipoDano === 'fisico' ? atributos.forca : atributos.inteligencia
  const secundario = tipoDano === 'fisico' ? atributos.inteligencia : atributos.forca

  const poderArma = arma ? poderDoItem(arma.raridade) : 0

  let poderPecas = 0
  let emSinergia = 0
  for (const slot of SLOTS_DE_PODER) {
    if (slot === 'arma') continue
    const peca = loadout[slot]
    if (!peca) continue

    const base = poderDoItem(peca.raridade)
    if (peca.afinidade && peca.afinidade === tipoDano) {
      poderPecas += base * (1 + BONUS_DE_SINERGIA)
      emSinergia += 1
    } else {
      poderPecas += base
    }
  }

  const poderAtributos = principal + Math.floor(secundario / 2)
  const multiplicador = multiplicadorDeConjunto(loadout)

  return {
    arma: poderArma,
    pecas: Math.floor(poderPecas),
    atributos: poderAtributos,
    multiplicadorConjunto: multiplicador,
    pecasEmSinergia: emSinergia,
    total: Math.floor((poderArma + poderPecas + poderAtributos) * multiplicador),
  }
}

/** Loadout vazio — usado por quem ainda não equipou nada. */
export function loadoutVazio(): Loadout {
  return {}
}
