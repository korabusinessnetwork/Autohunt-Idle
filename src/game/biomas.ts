// Os 16 biomas — o CATÁLOGO DE TEMA, e só isso.
//
// Implementa `specs/mapa-mundo-e-dungeon.md`, amendada três vezes:
// `specs/mundo-aberto-e-modo-manual.md`,
// `specs/mapas-instanciados-combate-e-hud.md` e
// `specs/fabrica-morta-biomas-9-a-16.md`.
//
// TRÊS MUDANÇAS DE PREMISSA, nesta ordem:
//   · 2026-08-12 — bioma era função do NÍVEL (você "entrava" no bioma 3 ao
//     chegar no nível 251, sem sair do lugar) e passou a ser LUGAR: uma grade
//     de 8 regiões dentro de um mapa único.
//   · 2026-08-13 — a grade acabou. Cada bioma virou um MAPA instanciado, e a
//     geometria (tamanho, entrada, intensidade, pool) mudou-se para `mapas.ts`.
//   · 2026-08-19 — a leva dobrou, de 8 para 16. Os oito primeiros são o
//     universo doce; os oito novos são a MESMA fábrica depois que ela parou.
//     Não é "mais oito sabores": é ruína industrial, com começo (a linha ainda
//     molhada de refrigerante) e fim (o forno que segue aceso sem ninguém).
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

export const TOTAL_BIOMAS = 16

export interface Bioma {
  id: number
  nome: ChaveI18n
  /** Sufixo dos tokens `--bioma-N-*`. Nunca um hex. */
  token: number
  /** O inimigo que só existe nesta zona. SOMA ao pool base, não substitui. */
  assinatura: EspecieInimigo
}

/**
 * As 16 formas assinatura. Cada uma é uma silhueta própria em `sprites.ts` —
 * 16 desenhos no total, não 80, que é exatamente a economia que a nota de
 * design da spec de origem justifica.
 *
 * A segunda metade (`latinha` … `caramelo`) é o arco da fábrica morta, e nasceu
 * com uma restrição de leitura explícita no briefing: nenhuma das oito repete a
 * SILHUETA de outra. Cilindro, coluna, triângulo, cabeça-com-haste, cubo,
 * horizontal-com-pontas, gota e massa pontuda — o jogador precisa saber o que
 * vem antes de ler o nome.
 */
export type FormaAssinatura =
  // Os oito do universo doce.
  | 'algodao'
  | 'geleia'
  | 'toffee'
  | 'concha'
  | 'trufa'
  | 'floco'
  | 'brasa'
  | 'confete'
  // Os oito da fábrica morta.
  | 'latinha'
  | 'tronco'
  | 'sino'
  | 'picole'
  | 'torrao'
  | 'bala'
  | 'gota'
  | 'caramelo'

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

  // -------------------------------------------------------------------------
  // A fábrica morta — biomas 9 a 16.
  //
  // O dano segue a silhueta, exatamente como no pool base e nos oito primeiros:
  // o que é grande e lento bate forte, o que é pequeno e rápido bate fraco. É o
  // contrato de leitura do gênero, e o jogador precisa saber o que dói olhando,
  // não morrendo.
  //
  // Os números NÃO sobem só por serem biomas tardios. Quem endurece o mapa
  // tardio é `escalaDoMapa`, em `mapas.ts`, e ele multiplica esta tabela. Subir
  // as duas coisas seria endurecer duas vezes o mesmo mapa sem ninguém pedir.
  // -------------------------------------------------------------------------
  {
    id: 9,
    nome: 'mundo.bioma9',
    token: 9,
    // Latinha Debochada — cilindro amassado, ágil e sem noção.
    assinatura: { forma: 'latinha', nome: 'inimigo.latinha', raio: 14, vida: 42, velocidade: 30, dano: 1.1 },
  },
  {
    id: 10,
    nome: 'mundo.bioma10',
    token: 10,
    // Tronco Atolado — coluna maciça presa no melaço. O mais lento do elenco.
    assinatura: { forma: 'tronco', nome: 'inimigo.tronco', raio: 20, vida: 76, velocidade: 10, dano: 2.1 },
  },
  {
    id: 11,
    nome: 'mundo.bioma11',
    token: 11,
    // Sino Rachado — triângulo largo embaixo, pesado e sem pressa.
    assinatura: { forma: 'sino', nome: 'inimigo.sino', raio: 18, vida: 64, velocidade: 18, dano: 1.8 },
  },
  {
    id: 12,
    nome: 'mundo.bioma12',
    token: 12,
    // Picolé Derretido — cabeça com haste, leve e rápido.
    assinatura: { forma: 'picole', nome: 'inimigo.picole', raio: 13, vida: 36, velocidade: 33, dano: 1.0 },
  },
  {
    id: 13,
    nome: 'mundo.bioma13',
    token: 13,
    // Torrão Bruto — cubo atarracado de punho solto.
    assinatura: { forma: 'torrao', nome: 'inimigo.torrao', raio: 17, vida: 66, velocidade: 20, dano: 1.7 },
  },
  {
    id: 14,
    nome: 'mundo.bioma14',
    token: 14,
    // Bala Perdida — horizontal com pontas torcidas. O mais rápido do jogo.
    assinatura: { forma: 'bala', nome: 'inimigo.bala', raio: 12, vida: 32, velocidade: 40, dano: 0.9 },
  },
  {
    id: 15,
    nome: 'mundo.bioma15',
    token: 15,
    // Gota Grossa — pêra pesada de chocolate. O mais duro do elenco.
    assinatura: { forma: 'gota', nome: 'inimigo.gota', raio: 19, vida: 80, velocidade: 13, dano: 2.2 },
  },
  {
    id: 16,
    nome: 'mundo.bioma16',
    token: 16,
    // Caramelo Queimado — massa pontuda de olho em brasa. O fecho do arco.
    assinatura: { forma: 'caramelo', nome: 'inimigo.caramelo', raio: 16, vida: 72, velocidade: 28, dano: 2.0 },
  },
]

/** O bioma de um id, com queda para o primeiro quando o id não existe. */
export function biomaPorId(id: number): Bioma {
  return BIOMAS.find((bioma) => bioma.id === id) ?? BIOMAS[0]!
}
