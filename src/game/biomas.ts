// Os 8 biomas — progressão VISUAL do nível 1 ao 1000.
//
// Implementa `specs/mapa-mundo-e-dungeon.md`.
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

export const NIVEIS_POR_BLOCO = 25
export const BLOCOS_POR_BIOMA = 5
export const NIVEIS_POR_BIOMA = NIVEIS_POR_BLOCO * BLOCOS_POR_BIOMA // 125
export const TOTAL_BIOMAS = 8
/** Último nível com conteúdo visual planejado. O nível em si é infinito. */
export const NIVEL_MAXIMO_PLANEJADO = NIVEIS_POR_BIOMA * TOTAL_BIOMAS // 1000

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

/**
 * Nível saneado.
 *
 * Nível inválido (0, negativo, `NaN`, fracionário) vira 1 em vez de quebrar o
 * render: tela branca é o que o Princípio nº1 proíbe acima de tudo, e o valor
 * chega do snapshot — ou seja, de fora deste módulo.
 */
function nivelValido(nivel: number): number {
  if (!Number.isFinite(nivel)) return 1
  return Math.max(1, Math.floor(nivel))
}

/**
 * Bioma do nível, de 1 a 8.
 *
 * Acima de 1000 permanece no 8: o nível é infinito (`specs/ranking-global.md`),
 * o conteúdo visual não — e planejar arte além disso é trabalho de quando
 * houver demanda real.
 */
export function biomaDoNivel(nivel: number): Bioma {
  const n = nivelValido(nivel)
  const indice = Math.min(TOTAL_BIOMAS - 1, Math.floor((n - 1) / NIVEIS_POR_BIOMA))
  return BIOMAS[indice]!
}

/** Bloco dentro do bioma, de 1 a 5. Acima de 1000 fica no 5. */
export function blocoDoNivel(nivel: number): number {
  const n = nivelValido(nivel)
  if (n > NIVEL_MAXIMO_PLANEJADO) return BLOCOS_POR_BIOMA

  const dentroDoBioma = (n - 1) % NIVEIS_POR_BIOMA
  return Math.floor(dentroDoBioma / NIVEIS_POR_BLOCO) + 1
}

/**
 * Intensidade visual do bloco, de 0 a 1.
 *
 * É o que faz os 5 blocos de um mesmo bioma parecerem diferentes sem arte
 * nova (critério 2 da spec de origem): o cenário fica mais saturado e mais
 * denso, e os inimigos maiores, reaproveitando o mesmo tema.
 */
export function intensidadeDoBloco(nivel: number): number {
  return (blocoDoNivel(nivel) - 1) / (BLOCOS_POR_BIOMA - 1)
}

/**
 * O pool completo da zona: os 5 inimigos base MAIS o assinatura do bioma.
 *
 * "Mais", não "no lugar de" — é o critério 7 da spec de origem, e é o que dá
 * identidade à zona sem exigir um roster novo por bioma.
 */
export function poolDoBioma(
  base: readonly EspecieInimigo[],
  nivel: number,
): readonly EspecieInimigo[] {
  return [...base, biomaDoNivel(nivel).assinatura]
}
