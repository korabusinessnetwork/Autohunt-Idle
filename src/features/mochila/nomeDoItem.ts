import { familiaDaArma, type FamiliaArma } from '../../game/armas'
import { nomeDaRaridade, type Raridade } from '../../game/regrasLoot'
import type { ChaveI18n } from '../../lib/i18n'
import type { TipoDano, TipoItem } from '../../lib/tipos'
import { ROTULO_TIPO } from './rotulos'

// O nome de uma peça (pedido do dono, 2026-08-13).
//
// Até aqui a lista da mochila escrevia o SLOT no lugar do nome: nove linhas
// dizendo "Arma", diferentes só pela cor da raridade. Slot não é nome — e a
// informação que faltava já existia no jogo, só não chegava à tela. A família
// da arma (espada, adaga, arco, martelo, cajado, varinha) sai de
// `familiaDaArma`, a MESMA função que decide o ícone e o comportamento de
// combate. Uma peça que se chama "Espada lendária" desenha uma espada e bate
// como espada, porque as três respostas vêm do mesmo hash do id.
//
// GÊNERO. Em português o adjetivo vem depois do substantivo e concorda com ele:
// "Espada lendária", mas "Cajado lendário". Errar isso é o tipo de coisa que
// faz um jogo parecer traduzido por máquina. A concordância é resolvida com
// duas tabelas de adjetivo — `m` e `f` — e o gênero é uma propriedade da BASE,
// não da raridade. Em inglês o adjetivo vem antes e não concorda, então as duas
// tabelas apontam para a mesma palavra e o formato inverte a ordem; nada disso
// vaza para cá, porque a ordem também é uma chave traduzível (`item.nome`).
//
// Chave e pedras ficam de fora: "Chave lendária" não quer dizer nada — elas não
// têm tier de raridade que o jogador persiga, e o nome cru já é o nome delas.

type Genero = 'm' | 'f'

interface Base {
  chave: ChaveI18n
  genero: Genero
}

/** As seis famílias de arma. O gênero é o da palavra em português. */
const BASE_DA_ARMA: Record<FamiliaArma, Base> = {
  espada: { chave: 'item.base.espada', genero: 'f' },
  adaga: { chave: 'item.base.adaga', genero: 'f' },
  arco: { chave: 'item.base.arco', genero: 'm' },
  martelo: { chave: 'item.base.martelo', genero: 'm' },
  cajado: { chave: 'item.base.cajado', genero: 'm' },
  varinha: { chave: 'item.base.varinha', genero: 'f' },
}

/** Gênero do rótulo de cada tipo, para quando a base é o próprio tipo. */
const GENERO_DO_TIPO: Record<TipoItem, Genero> = {
  arma: 'f',
  capacete: 'm',
  armadura: 'f',
  luva: 'f',
  bota: 'f',
  acessorio: 'm',
  skin: 'f',
  chave: 'f',
  pedra_fortificacao: 'f',
  pedra_sorte: 'f',
  pedra_garantia: 'f',
}

// Mapas explícitos, e não template string, pelo mesmo motivo de `rotulos.ts`: é
// assim que o TypeScript confere cada chave e que o teste de chave órfã enxerga
// o uso.
const ADJETIVO_M: Record<Raridade, ChaveI18n> = {
  comum: 'item.adj.m.comum',
  incomum: 'item.adj.m.incomum',
  raro: 'item.adj.m.raro',
  epico: 'item.adj.m.epico',
  lendario: 'item.adj.m.lendario',
  caramelizado: 'item.adj.m.caramelizado',
  glaceado: 'item.adj.m.glaceado',
  dourado: 'item.adj.m.dourado',
  cristalizado: 'item.adj.m.cristalizado',
  cosmico: 'item.adj.m.cosmico',
}

const ADJETIVO_F: Record<Raridade, ChaveI18n> = {
  comum: 'item.adj.f.comum',
  incomum: 'item.adj.f.incomum',
  raro: 'item.adj.f.raro',
  epico: 'item.adj.f.epico',
  lendario: 'item.adj.f.lendario',
  caramelizado: 'item.adj.f.caramelizado',
  glaceado: 'item.adj.f.glaceado',
  dourado: 'item.adj.f.dourado',
  cristalizado: 'item.adj.f.cristalizado',
  cosmico: 'item.adj.f.cosmico',
}

/** Não recebem adjetivo de raridade: o nome cru já é o nome. */
const SEM_ADJETIVO: readonly TipoItem[] = [
  'chave',
  'pedra_fortificacao',
  'pedra_sorte',
  'pedra_garantia',
]

/**
 * O mínimo para nomear.
 *
 * `id` e `tipoDano` são opcionais de propósito: a lista de síntese trabalha com
 * PILHAS (tipo × raridade), que não têm um id só. Sem id, uma arma volta a se
 * chamar "Arma" — que é a resposta certa para uma pilha de nove armas
 * diferentes, e seria mentira para uma peça.
 */
export interface DadosDeNome {
  tipo: TipoItem
  raridade: number
  id?: string
  tipoDano?: TipoDano | null
}

export type Traduzir = (chave: ChaveI18n, valores?: Record<string, string | number>) => string

/** A base do nome: a família, quando é uma arma identificável; senão, o tipo. */
export function baseDoItem(item: DadosDeNome): Base {
  if (item.tipo === 'arma' && item.id) {
    return BASE_DA_ARMA[familiaDaArma(item.id, item.tipoDano ?? null)]
  }
  return { chave: ROTULO_TIPO[item.tipo], genero: GENERO_DO_TIPO[item.tipo] }
}

/** "Espada lendária", "Cajado cósmico", "Legendary sword". */
export function nomeDoItem(item: DadosDeNome, t: Traduzir): string {
  const base = baseDoItem(item)
  const rotulo = t(base.chave)

  if (SEM_ADJETIVO.includes(item.tipo)) return rotulo

  const adjetivos = base.genero === 'f' ? ADJETIVO_F : ADJETIVO_M
  return t('item.nome', {
    base: rotulo,
    adjetivo: t(adjetivos[nomeDaRaridade(item.raridade)]),
  })
}
