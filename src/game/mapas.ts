// Os 8 mapas — instâncias, não regiões de um mapa único.
//
// MUDANÇA DE PREMISSA (2026-08-13, `specs/mapas-instanciados-combate-e-hud.md`):
// até ontem existia UM mapa de 5120×1440 dividido numa grade de 8 regiões, e o
// bioma saía de onde o herói estava. Agora cada bioma é um mapa fechado, e
// trocar de mapa é uma escolha do jogador — pelo botão de mapa — travada por
// nível.
//
// A REGRA QUE MOLDA ESTE ARQUIVO, herdada de `biomas.ts` e igualmente
// inegociável: mapa é cenário. Nada aqui entra em cálculo de recompensa e nada
// aqui é enviado ao servidor. Um jogador que force o mapa 8 no nível 1 vê o
// cenário do endgame e ganha exatamente o que ganhava — o servidor credita por
// tempo × poder e não sabe onde o herói está.
//
// O nível ENTRA aqui, mas só numa direção: ele vem do servidor e decide o que
// está destravado. Nenhuma função deste arquivo produz número que volte para
// lá. Um teste confere que `regras*.ts` não importa este módulo.

import { BIOMAS, TOTAL_BIOMAS, type Bioma } from './biomas'
import type { EspecieInimigo } from './mundo'

/** Um mapa a cada 10 níveis. */
export const NIVEIS_POR_MAPA = 10

/**
 * A primeira leva: 8 mapas, cobrindo até o nível 80.
 *
 * Nível continua infinito (core): passar de 80 não trava nada, o jogador
 * simplesmente segue no mapa 8 até a próxima leva de mapas entrar. É conteúdo
 * que falta, não teto que existe.
 */
export const TOTAL_MAPAS = TOTAL_BIOMAS

/** O nível em que a primeira leva deixa de ter mapa novo a oferecer. */
export const NIVEL_DA_ULTIMA_LEVA = TOTAL_MAPAS * NIVEIS_POR_MAPA

/**
 * Todo mapa tem o mesmo tamanho: 3×3 viewports.
 *
 * Grande o bastante para o herói PROCURAR inimigo (critério 4 da spec), pequeno
 * o bastante para atravessar sem virar caminhada — e igual para todos porque a
 * dificuldade percebida já vem do tema e da população, não de metragem.
 */
export const LARGURA_MAPA = 1920
export const ALTURA_MAPA = 1080

/**
 * Quantos degraus de intensidade visual um mapa tem.
 *
 * Herança do desenho anterior, e continua valendo pelo mesmo motivo: o fundo
 * varia enquanto o jogador atravessa, sem exigir arte nova. O que mudou é a
 * âncora — antes crescia a partir do canto da região, agora a partir do CENTRO
 * do mapa, que é onde o herói entra.
 */
export const BLOCOS_POR_MAPA = 5

/** Quantos ninhos de inimigo cada mapa tem. Ver `mundo.ts`. */
export const NINHOS_POR_MAPA = 16

export interface Mapa {
  id: number
  /** O tema. Um por mapa, na ordem dos 8 biomas. */
  bioma: Bioma
  /** Nível a partir do qual o mapa abre. */
  nivelMinimo: number
}

export const MAPAS: readonly Mapa[] = BIOMAS.map((bioma, indice) => ({
  id: indice + 1,
  bioma,
  nivelMinimo: indice * NIVEIS_POR_MAPA + 1,
}))

/** O mapa de um id, com queda para o primeiro quando o id não existe. */
export function mapaPorId(id: number): Mapa {
  return MAPAS.find((mapa) => mapa.id === id) ?? MAPAS[0]!
}

/** Se o jogador daquele nível pode entrar. */
export function mapaLiberado(mapa: Mapa, nivel: number): boolean {
  return nivelValido(nivel) >= mapa.nivelMinimo
}

/**
 * O mapa mais avançado que o nível libera.
 *
 * É o que o botão de mapa sugere e o que o jogo abre quando o jogador ainda não
 * escolheu nada — chegar no nível 11 e continuar na floresta porque ninguém
 * avisou seria exatamente a fricção que o Princípio nº1 proíbe.
 */
export function mapaSugerido(nivel: number): Mapa {
  const indice = Math.min(
    TOTAL_MAPAS,
    Math.floor((nivelValido(nivel) - 1) / NIVEIS_POR_MAPA) + 1,
  )
  return mapaPorId(indice)
}

/** Quantos níveis faltam para destravar. Zero quando já está liberado. */
export function niveisParaLiberar(mapa: Mapa, nivel: number): number {
  return Math.max(0, mapa.nivelMinimo - nivelValido(nivel))
}

function nivelValido(nivel: number): number {
  if (!Number.isFinite(nivel)) return 1
  return Math.max(1, Math.trunc(nivel))
}

/** Mantém a coordenada dentro do mapa, mesmo se vier `NaN` de algum lugar. */
function coordenadaValida(valor: number, maximo: number): number {
  if (!Number.isFinite(valor)) return 0
  return Math.min(maximo - 1, Math.max(0, valor))
}

/** Onde o herói entra no mapa: o centro. */
export function entradaDoMapa(): { x: number; y: number } {
  return { x: LARGURA_MAPA / 2, y: ALTURA_MAPA / 2 }
}

/**
 * Intensidade visual da posição, de 0 a 1.
 *
 * Cresce do centro para a borda: o herói entra no ponto calmo e a arena fica
 * mais carregada conforme ele se afasta. É o mesmo truque de sempre — variação
 * de fundo sem arte nova — com âncora nova.
 */
export function intensidadeDaPosicao(x: number, y: number): number {
  const dx = (coordenadaValida(x, LARGURA_MAPA) - LARGURA_MAPA / 2) / (LARGURA_MAPA / 2)
  const dy = (coordenadaValida(y, ALTURA_MAPA) - ALTURA_MAPA / 2) / (ALTURA_MAPA / 2)
  const proporcao = Math.min(1, Math.hypot(dx, dy) / Math.SQRT2)

  // Discretiza em degraus: variação contínua faria o fundo "respirar" a cada
  // passo, que é pior que mudar em degraus perceptíveis.
  const bloco = Math.min(BLOCOS_POR_MAPA - 1, Math.floor(proporcao * BLOCOS_POR_MAPA))
  return bloco / (BLOCOS_POR_MAPA - 1)
}

/**
 * O pool do mapa: os inimigos base MAIS o assinatura do bioma.
 *
 * "Mais", não "no lugar de" — continua sendo o critério 7 da spec dos oito
 * biomas, agora ancorado no mapa em vez da região.
 */
export function poolDoMapa(
  base: readonly EspecieInimigo[],
  mapa: Mapa,
): readonly EspecieInimigo[] {
  return [...base, mapa.bioma.assinatura]
}

/**
 * Quanto o mapa endurece o inimigo.
 *
 * O mapa 8 é o endgame e precisa PARECER endgame. Vida e dano sobem juntos, de
 * forma previsível — e continuam não valendo nada: derrubar um inimigo do mapa
 * 8 credita o mesmo que derrubar um do mapa 1, porque quem credita é o servidor
 * e ele não sabe onde o herói está.
 */
export function escalaDoMapa(mapa: Mapa): number {
  return 1 + (mapa.id - 1) * 0.35
}
