// Regras de equipamento — espelho puro do que roda no Postgres.
//
// A variedade do jogo vem do LOOT, não de uma escolha inicial: não existe
// classe em lugar nenhum (`specs/equipamento-e-poder.md`, critério 1). "Build
// de mago" é uma identidade que emerge de varinha + acessórios mágicos, e some
// no instante em que o jogador troca de arma.
//
// Skin não aparece em nenhuma função deste arquivo, de propósito: é assim que
// "skin nunca tem stat" deixa de ser promessa e vira propriedade estrutural.

import type { Atributos } from './regrasAtributos'

export type TipoDano = 'fisico' | 'magico'
export type SlotEquipamento = 'arma' | 'acessorio1' | 'acessorio2'

export interface ItemEquipado {
  raridade: number
  /** Só arma tem tipo de dano. */
  tipoDano?: TipoDano | null
  /** Só acessório tem afinidade, e ela é opcional. */
  afinidade?: TipoDano | null
  /** Só item épico ou superior pertence a conjunto. */
  conjuntoId?: string | null
}

export interface Loadout {
  arma: ItemEquipado | null
  acessorio1: ItemEquipado | null
  acessorio2: ItemEquipado | null
}

/** Quanto stat um item rende, em função da raridade (decisão D1). */
export function poderDoItem(raridade: number): number {
  const tier = Math.min(10, Math.max(0, Math.trunc(raridade)))
  // Cresce mais que linear: cósmico precisa parecer cósmico.
  return tier * tier + tier * 3
}

/** Bônus que um acessório ganha quando a afinidade dele bate com a arma. */
const BONUS_DE_SINERGIA = 0.2
const BONUS_CONJUNTO_2_PECAS = 0.1
/** Maior que o dobro do de 2 peças — o conjunto completo precisa valer a pena. */
const BONUS_CONJUNTO_COMPLETO = 0.35

/** Quantas peças do conjunto mais representado o loadout tem. */
export function pecasDoMaiorConjunto(loadout: Loadout): { conjuntoId: string | null; pecas: number } {
  const contagem = new Map<string, number>()

  for (const item of [loadout.arma, loadout.acessorio1, loadout.acessorio2]) {
    if (!item?.conjuntoId) continue
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
 * Só o conjunto mais representado conta: 2 peças de um e 1 de outro ativam
 * apenas o bônus de 2 do primeiro (critério 16). Bônus parcial não empilha
 * entre conjuntos diferentes.
 */
export function multiplicadorDeConjunto(loadout: Loadout): number {
  const { pecas } = pecasDoMaiorConjunto(loadout)
  if (pecas >= 3) return 1 + BONUS_CONJUNTO_COMPLETO
  if (pecas >= 2) return 1 + BONUS_CONJUNTO_2_PECAS
  return 1
}

export interface DetalhePoder {
  /** Contribuição da arma. */
  arma: number
  /** Contribuição somada dos acessórios, já com sinergia. */
  acessorios: number
  /** Contribuição dos atributos, já ponderada pelo tipo de dano da arma. */
  atributos: number
  /** Multiplicador de conjunto aplicado ao total. */
  multiplicadorConjunto: number
  /** Quantos acessórios tiveram a afinidade batendo. */
  acessoriosEmSinergia: number
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
  const tipoDano: TipoDano = loadout.arma?.tipoDano ?? 'fisico'

  const principal = tipoDano === 'fisico' ? atributos.forca : atributos.inteligencia
  const secundario = tipoDano === 'fisico' ? atributos.inteligencia : atributos.forca

  const poderArma = loadout.arma ? poderDoItem(loadout.arma.raridade) : 0

  let poderAcessorios = 0
  let emSinergia = 0
  for (const acessorio of [loadout.acessorio1, loadout.acessorio2]) {
    if (!acessorio) continue
    const base = poderDoItem(acessorio.raridade)
    if (acessorio.afinidade && acessorio.afinidade === tipoDano) {
      poderAcessorios += base * (1 + BONUS_DE_SINERGIA)
      emSinergia += 1
    } else {
      poderAcessorios += base
    }
  }

  const poderAtributos = principal + Math.floor(secundario / 2)
  const multiplicador = multiplicadorDeConjunto(loadout)

  return {
    arma: poderArma,
    acessorios: Math.floor(poderAcessorios),
    atributos: poderAtributos,
    multiplicadorConjunto: multiplicador,
    acessoriosEmSinergia: emSinergia,
    total: Math.floor((poderArma + poderAcessorios + poderAtributos) * multiplicador),
  }
}

/** Loadout vazio — usado por quem ainda não equipou nada. */
export function loadoutVazio(): Loadout {
  return { arma: null, acessorio1: null, acessorio2: null }
}
