// Regras de farm — espelho em TypeScript do que roda no Postgres.
//
// ATENÇÃO AO PAPEL DESTE ARQUIVO: ele NÃO decide recompensa. Quem credita XP,
// moeda e nível é a RPC `SECURITY DEFINER` (`supabase/migrations/
// 20260811_rpc_farm_e_sessao.sql`), usando `now()` do Postgres. O que está aqui
// serve para (a) a simulação visual do combate ao vivo e (b) previsão de UI —
// nenhum resultado calculado aqui é enviado ao servidor, e o servidor não teria
// como aceitar se fosse.
//
// Como a matemática é determinística e sem aleatoriedade, o espelho pode ser
// testado sozinho e serve de documentação executável da regra do SQL.

import { atributosZerados, type Atributos } from './regrasAtributos'
import { calcularPoderDeAtaque, loadoutVazio } from './regrasEquipamento'

/** Duração de um ciclo de farm, em segundos. Espelha `c_ciclo_segundos`. */
export const CICLO_SEGUNDOS = 15

/**
 * Teto de tempo que um único lote da sessão ao vivo pode creditar. Aba
 * suspensa pelo navegador não conta como "ao vivo": o excedente é descartado,
 * nunca convertido em farm offline por via lateral.
 */
export const LIMITE_LOTE_SEGUNDOS = 120

/** Intervalo entre validações de lote na sessão ao vivo (decisão D5 do spec). */
export const INTERVALO_LOTE_MS = CICLO_SEGUNDOS * 1000

export const MINUTOS_POR_ANUNCIO = 15
export const TETO_ANUNCIO_DIARIO_MIN = 120
export const TETO_ASSINANTE_MIN = 24 * 60

// Constantes de balanceamento.
//
// MUDOU EM 2026-08-12 (`specs/console-de-ajuste.md`): no servidor elas deixaram
// de ser `constant` e viraram linhas da tabela `ajuste`, editáveis pelo dono.
// Os números abaixo são o PADRÃO semeado — o mesmo que `ajuste_num` usa quando
// a linha não existe — e é isso que `espelhoDeRegra.test.ts` verifica.
//
// Consequência que precisa ficar escrita: depois que o dono ajustar um destes,
// **o espelho deixa de prever o crédito**. Ele não é usado em previsão de tela
// hoje (só nos próprios testes), e por isso a divergência não aparece para
// ninguém — mas quem for usá-lo em UI precisa saber que os valores econômicos
// vigentes não chegam ao client de propósito.
export const ABATES_BASE = 3
export const XP_BASE_POR_ABATE = 4
export const MOEDA_BASE_POR_ABATE = 2
export const DANO_BASE_POR_CICLO = 8
/** Quanto cada ponto de Vitalidade acrescenta à Vitalidade máxima. */
const VITALIDADE_POR_PONTO = 25
/**
 * Quantos pontos de poder de ataque valem um abate a mais por ciclo.
 *
 * Dizia "Força + Inteligência" e era verdade quando os dois atributos somavam
 * juntos. Desde 2026-08-14 quem entra é só o atributo do canal da arma
 * equipada (`regrasEquipamento.ts`, `ATRIBUTO_DO_DANO`) — e, com equipamento, o
 * que chega aqui já é o poder final do loadout, não atributo cru.
 */
export const ATAQUE_POR_ABATE = 8

/**
 * XP total exigido para alcançar o nível informado: `50 * (n-1) * n`.
 * A curva cresce e não tem teto (core, 12) — não existe NIVEL_MAXIMO aqui
 * nem em lugar nenhum do projeto, de propósito.
 */
export function xpAcumuladoParaNivel(nivel: number): number {
  return 50 * (nivel - 1) * nivel
}

/** Inverso da curva, com correção exata nas bordas do arredondamento. */
export function nivelPorXp(xpTotal: number): number {
  if (!Number.isFinite(xpTotal) || xpTotal <= 0) return 1

  let nivel = Math.floor((1 + Math.sqrt(1 + (4 * xpTotal) / 50)) / 2)
  if (nivel < 1) nivel = 1

  while (xpAcumuladoParaNivel(nivel + 1) <= xpTotal) nivel += 1
  while (nivel > 1 && xpAcumuladoParaNivel(nivel) > xpTotal) nivel -= 1

  return nivel
}

/**
 * Vitalidade máxima do ciclo de farm.
 *
 * Escala com o nível para a frequência de derrota não piorar conforme o
 * jogador cresce, e com o atributo Vitalidade — que é justamente o que ele
 * compra ao investir nele (`specs/ranking-global.md`, critério 8).
 */
export function vitalidadeMaxima(nivel: number, vitalidade = 0): number {
  return 100 + nivel * 10 + vitalidade * VITALIDADE_POR_PONTO
}

/**
 * Abates por ciclo.
 *
 * O poder de ataque vem do loadout (`regrasEquipamento.ts`), que SELECIONA o
 * atributo pelo tipo de dano da arma — um só conta, os outros não entram —,
 * aplica sinergia de afinidade e o bônus de conjunto. Aqui só entra o número
 * final: o cálculo de recompensa não conhece item, e por isso também não
 * conhece skin.
 */
export function abatesPorCiclo(nivel: number, poderDeAtaque = 0): number {
  return ABATES_BASE + Math.floor(nivel / 10) + Math.floor(poderDeAtaque / ATAQUE_POR_ABATE)
}

export function xpPorAbate(nivel: number): number {
  return XP_BASE_POR_ABATE + nivel
}

export function moedaPorAbate(nivel: number): number {
  return MOEDA_BASE_POR_ABATE + Math.floor(nivel / 2)
}

export function danoPorCiclo(nivel: number): number {
  return DANO_BASE_POR_CICLO + nivel
}

export interface ResultadoCiclos {
  xp: number
  moeda: number
  vitalidade: number
  ciclosPerdidos: number
}

/**
 * Resolve N ciclos de farm.
 *
 * Quando a Vitalidade zera, o ciclo em andamento não rende — e só ele
 * (core, 16). Nada já creditado é retirado, não há cooldown e o personagem
 * volta a farmar no ciclo seguinte com a Vitalidade cheia.
 */
export function resolverCiclos(
  nivel: number,
  vitalidadeInicial: number,
  ciclos: number,
  multiplicadorXp: number,
  atributos: Atributos = atributosZerados(),
  poderDeAtaque?: number,
): ResultadoCiclos {
  const vitMax = vitalidadeMaxima(nivel, atributos.vitalidade)
  const abates = abatesPorCiclo(
    nivel,
    poderDeAtaque ?? calcularPoderDeAtaque(loadoutVazio(), atributos).total,
  )
  const xpAbate = xpPorAbate(nivel)
  const moedaAbate = moedaPorAbate(nivel)
  const dano = danoPorCiclo(nivel)

  let vitalidade =
    vitalidadeInicial <= 0 || vitalidadeInicial > vitMax ? vitMax : vitalidadeInicial
  let xp = 0
  let moeda = 0
  let ciclosPerdidos = 0

  if (!Number.isFinite(ciclos) || ciclos <= 0) {
    return { xp, moeda, vitalidade, ciclosPerdidos }
  }

  for (let i = 0; i < ciclos; i++) {
    vitalidade -= dano
    if (vitalidade <= 0) {
      ciclosPerdidos += 1
      vitalidade = vitMax
    } else {
      xp += abates * xpAbate * multiplicadorXp
      moeda += abates * moedaAbate
    }
  }

  return { xp, moeda, vitalidade, ciclosPerdidos }
}

/**
 * Teto de minutos de farm offline que o jogador consegue aproveitar.
 * Assinante: 24h (core, 4). Não-assinante: só o que os anúncios já
 * desbloquearam — 0 por padrão (core, 5 e 6).
 */
export function tetoOfflineMinutos(assinante: boolean, minutosAnuncioSaldo: number): number {
  return assinante ? TETO_ASSINANTE_MIN : Math.max(0, minutosAnuncioSaldo)
}
