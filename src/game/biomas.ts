// Os 8 biomas — REGIÕES do mapa.
//
// Implementa `specs/mapa-mundo-e-dungeon.md`, amendada por
// `specs/mundo-aberto-e-modo-manual.md`.
//
// MUDANÇA DE PREMISSA (2026-08-12): bioma era função do NÍVEL — você "entrava"
// no bioma 3 ao chegar no nível 251, sem sair do lugar. Agora é LUGAR: o mapa
// tem 8 regiões, e o bioma corrente sai de onde o herói está. Subir de nível
// não muda mais o cenário, e andar muda.
//
// A REGRA QUE MOLDA ESTE ARQUIVO: bioma é cenário, e só cenário. Nada aqui
// entra em cálculo de recompensa, e nada aqui é enviado ao servidor. No
// instante em que "estar no bioma 7" mudasse um número que o servidor credita,
// a regra que sustenta o produto (o client nunca declara ganho) passaria a
// depender de um cálculo que roda no navegador do jogador.
//
// Por isso este módulo não importa nada de `regras*.ts`, e nenhum `regras*.ts`
// importa este módulo — um teste confere a ausência das duas direções.
//
// Nenhuma cor nasce aqui: os tokens vivem em `src/styles/tokens.css`, que é a
// fonte única da paleta, e o canvas os lê em runtime (`paleta.ts`).

import type { ChaveI18n } from '../lib/i18n'
import type { EspecieInimigo } from './mundo'

export const TOTAL_BIOMAS = 8

/**
 * O mapa é uma grade de 4×2 regiões. Cada uma tem 2× a viewport em cada eixo,
 * então atravessar uma região a pé leva tempo suficiente para ela parecer um
 * lugar, e não um corredor.
 */
export const COLUNAS_DE_REGIAO = 4
export const LINHAS_DE_REGIAO = 2
export const LARGURA_REGIAO = 1280
export const ALTURA_REGIAO = 720

export const LARGURA_MAPA = LARGURA_REGIAO * COLUNAS_DE_REGIAO // 5120
export const ALTURA_MAPA = ALTURA_REGIAO * LINHAS_DE_REGIAO // 1440

/**
 * Quantos "blocos" de intensidade visual cada região tem.
 *
 * Herança do desenho anterior, e continua valendo: dentro de uma região a
 * intensidade cresce conforme o herói se afasta da borda de entrada, o que faz
 * o fundo de uma região não ser chapado do começo ao fim — sem exigir arte
 * nova (critério 2 da spec de origem).
 */
export const BLOCOS_POR_BIOMA = 5

export interface Bioma {
  id: number
  nome: ChaveI18n
  /** Sufixo dos tokens `--bioma-N-*`. Nunca um hex. */
  token: number
  /** O inimigo que só existe nesta zona. SOMA ao pool base, não substitui. */
  assinatura: EspecieInimigo
}

/**
 * As 8 formas assinatura. Cada uma é uma silhueta própria em `sprites.ts` —
 * 8 desenhos novos no total, não 40, que é exatamente a economia que a nota de
 * design da spec de origem justifica.
 */
export type FormaAssinatura =
  | 'algodao'
  | 'geleia'
  | 'toffee'
  | 'concha'
  | 'trufa'
  | 'floco'
  | 'brasa'
  | 'confete'

export const BIOMAS: readonly Bioma[] = [
  {
    id: 1,
    nome: 'mundo.bioma1',
    token: 1,
    assinatura: { forma: 'algodao', nome: 'inimigo.algodao', raio: 15, vida: 34, velocidade: 22 },
  },
  {
    id: 2,
    nome: 'mundo.bioma2',
    token: 2,
    assinatura: { forma: 'geleia', nome: 'inimigo.geleia', raio: 17, vida: 52, velocidade: 14 },
  },
  {
    id: 3,
    nome: 'mundo.bioma3',
    token: 3,
    assinatura: { forma: 'toffee', nome: 'inimigo.toffee', raio: 13, vida: 40, velocidade: 32 },
  },
  {
    id: 4,
    nome: 'mundo.bioma4',
    token: 4,
    assinatura: { forma: 'concha', nome: 'inimigo.concha', raio: 16, vida: 46, velocidade: 26 },
  },
  {
    id: 5,
    nome: 'mundo.bioma5',
    token: 5,
    assinatura: { forma: 'trufa', nome: 'inimigo.trufa', raio: 19, vida: 70, velocidade: 12 },
  },
  {
    id: 6,
    nome: 'mundo.bioma6',
    token: 6,
    assinatura: { forma: 'floco', nome: 'inimigo.floco', raio: 12, vida: 28, velocidade: 38 },
  },
  {
    id: 7,
    nome: 'mundo.bioma7',
    token: 7,
    assinatura: { forma: 'brasa', nome: 'inimigo.brasa', raio: 14, vida: 44, velocidade: 34 },
  },
  {
    id: 8,
    nome: 'mundo.bioma8',
    token: 8,
    assinatura: { forma: 'confete', nome: 'inimigo.confete', raio: 15, vida: 58, velocidade: 30 },
  },
]

/** Mantém a coordenada dentro do mapa, mesmo se vier `NaN` de algum lugar. */
function coordenadaValida(valor: number, maximo: number): number {
  if (!Number.isFinite(valor)) return 0
  return Math.min(maximo - 1, Math.max(0, valor))
}

/**
 * Região do mapa onde a posição cai, de 1 a 8.
 *
 * Percorre a grade em leitura ocidental: 1–4 na linha de cima, 5–8 embaixo.
 * O herói nasce em (0,0), ou seja, na Floresta de Algodão-Doce.
 */
export function biomaDaPosicao(x: number, y: number): Bioma {
  const cx = Math.floor(coordenadaValida(x, LARGURA_MAPA) / LARGURA_REGIAO)
  const cy = Math.floor(coordenadaValida(y, ALTURA_MAPA) / ALTURA_REGIAO)
  return BIOMAS[cy * COLUNAS_DE_REGIAO + cx]!
}

/**
 * Intensidade visual dentro da região, de 0 a 1.
 *
 * Cresce com a distância até o canto de entrada da região. É o que faz o fundo
 * variar enquanto o jogador atravessa, reaproveitando o mesmo tema — a mesma
 * economia de arte que a spec de origem justifica, agora ancorada em lugar
 * em vez de nível.
 */
export function intensidadeDaPosicao(x: number, y: number): number {
  const dentroX = coordenadaValida(x, LARGURA_MAPA) % LARGURA_REGIAO
  const dentroY = coordenadaValida(y, ALTURA_MAPA) % ALTURA_REGIAO

  const proporcao =
    Math.hypot(dentroX / LARGURA_REGIAO, dentroY / ALTURA_REGIAO) / Math.SQRT2

  // Discretiza nos mesmos 5 degraus de antes: variação contínua faria o fundo
  // "respirar" a cada passo, que é pior que mudar em degraus perceptíveis.
  const bloco = Math.min(BLOCOS_POR_BIOMA - 1, Math.floor(proporcao * BLOCOS_POR_BIOMA))
  return bloco / (BLOCOS_POR_BIOMA - 1)
}

/**
 * O pool completo da região: os 5 inimigos base MAIS o assinatura do bioma.
 *
 * "Mais", não "no lugar de" — é o critério 7 da spec de origem, e é o que dá
 * identidade à zona sem exigir um roster novo por bioma.
 */
export function poolDaPosicao(
  base: readonly EspecieInimigo[],
  x: number,
  y: number,
): readonly EspecieInimigo[] {
  return [...base, biomaDaPosicao(x, y).assinatura]
}
