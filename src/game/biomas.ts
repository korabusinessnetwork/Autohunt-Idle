// Os 8 biomas — o CATÁLOGO DE TEMA, e só isso.
//
// Implementa `specs/mapa-mundo-e-dungeon.md`, amendada duas vezes:
// `specs/mundo-aberto-e-modo-manual.md` e
// `specs/mapas-instanciados-combate-e-hud.md`.
//
// DUAS MUDANÇAS DE PREMISSA, nesta ordem:
//   · 2026-08-12 — bioma era função do NÍVEL (você "entrava" no bioma 3 ao
//     chegar no nível 251, sem sair do lugar) e passou a ser LUGAR: uma grade
//     de 8 regiões dentro de um mapa único.
//   · 2026-08-13 — a grade acabou. Cada bioma virou um MAPA instanciado, e a
//     geometria (tamanho, entrada, intensidade, pool) mudou-se para `mapas.ts`.
//
// O que sobrou aqui é o que sempre foi o núcleo: nome, token de cor e o inimigo
// assinatura de cada tema.
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
    assinatura: { forma: 'algodao', nome: 'inimigo.algodao', raio: 15, vida: 34, velocidade: 22, dano: 0.9 },
  },
  {
    id: 2,
    nome: 'mundo.bioma2',
    token: 2,
    assinatura: { forma: 'geleia', nome: 'inimigo.geleia', raio: 17, vida: 52, velocidade: 14, dano: 1.6 },
  },
  {
    id: 3,
    nome: 'mundo.bioma3',
    token: 3,
    assinatura: { forma: 'toffee', nome: 'inimigo.toffee', raio: 13, vida: 40, velocidade: 32, dano: 1.0 },
  },
  {
    id: 4,
    nome: 'mundo.bioma4',
    token: 4,
    assinatura: { forma: 'concha', nome: 'inimigo.concha', raio: 16, vida: 46, velocidade: 26, dano: 1.2 },
  },
  {
    id: 5,
    nome: 'mundo.bioma5',
    token: 5,
    assinatura: { forma: 'trufa', nome: 'inimigo.trufa', raio: 19, vida: 70, velocidade: 12, dano: 2.0 },
  },
  {
    id: 6,
    nome: 'mundo.bioma6',
    token: 6,
    assinatura: { forma: 'floco', nome: 'inimigo.floco', raio: 12, vida: 28, velocidade: 38, dano: 0.8 },
  },
  {
    id: 7,
    nome: 'mundo.bioma7',
    token: 7,
    assinatura: { forma: 'brasa', nome: 'inimigo.brasa', raio: 14, vida: 44, velocidade: 34, dano: 1.4 },
  },
  {
    id: 8,
    nome: 'mundo.bioma8',
    token: 8,
    assinatura: { forma: 'confete', nome: 'inimigo.confete', raio: 15, vida: 58, velocidade: 30, dano: 1.8 },
  },
]

/** O bioma de um id, com queda para o primeiro quando o id não existe. */
export function biomaPorId(id: number): Bioma {
  return BIOMAS.find((bioma) => bioma.id === id) ?? BIOMAS[0]!
}
