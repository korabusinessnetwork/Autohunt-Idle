import { nomeDaRaridade, type Raridade } from '../../game/regrasLoot'
import type { ChaveI18n } from '../../lib/i18n'
import type { SlotEquipamento, TipoDano, TipoItem } from '../../lib/tipos'

// Mapas explícitos em vez de template string: assim o TypeScript confere cada
// chave contra `ChaveI18n`, e o teste de chave órfã enxerga o uso. Ficam num
// módulo só para a mochila e o painel de equipamento não divergirem.

export const ROTULO_RARIDADE: Record<Raridade, ChaveI18n> = {
  comum: 'raridade.comum',
  incomum: 'raridade.incomum',
  raro: 'raridade.raro',
  epico: 'raridade.epico',
  lendario: 'raridade.lendario',
  caramelizado: 'raridade.caramelizado',
  glaceado: 'raridade.glaceado',
  dourado: 'raridade.dourado',
  cristalizado: 'raridade.cristalizado',
  cosmico: 'raridade.cosmico',
}

export const ROTULO_TIPO: Record<TipoItem, ChaveI18n> = {
  arma: 'item.arma',
  capacete: 'item.capacete',
  armadura: 'item.armadura',
  luva: 'item.luva',
  bota: 'item.bota',
  acessorio: 'item.acessorio',
  skin: 'item.skin',
  chave: 'item.chave',
  pedra_fortificacao: 'item.pedra_fortificacao',
  pedra_sorte: 'item.pedra_sorte',
  pedra_garantia: 'item.pedra_garantia',
}

export const ROTULO_SLOT: Record<SlotEquipamento, ChaveI18n> = {
  arma: 'mochila.slot.arma',
  capacete: 'mochila.slot.capacete',
  armadura: 'mochila.slot.armadura',
  luva: 'mochila.slot.luva',
  bota: 'mochila.slot.bota',
  acessorio: 'mochila.slot.acessorio',
  skin: 'mochila.slot.skin',
}

/**
 * Nome de cada canal de dano — usado para o TIPO DE DANO da arma e para a
 * AFINIDADE das outras peças, que são a mesma escala.
 *
 * Estava copiado em `DetalheItem.tsx` e em `AbaEquipamento.tsx`: duas cópias da
 * mesma tabela, exatamente o defeito que este módulo existe para impedir. Com
 * dois canais a duplicata só era feia; com três, uma das cópias ficaria sem o
 * canal novo e a peça de Destreza apareceria sem tipo de dano numa das telas.
 */
export const ROTULO_DANO: Record<TipoDano, ChaveI18n> = {
  fisico: 'dano.fisico',
  destreza: 'dano.destreza',
  magico: 'dano.magico',
}

/**
 * Nome de cada conjunto.
 *
 * `Record<string, …>` e não `Record<ConjuntoId, …>` porque quem cria conjunto é
 * o servidor: uma peça pode chegar com um `conjunto_id` que esta versão do
 * client ainda não conhece, e nesse caso a linha do conjunto simplesmente não
 * aparece — melhor do que quebrar a tela inteira da mochila.
 */
export const ROTULO_CONJUNTO: Record<string, ChaveI18n> = {
  'bruxa-caramelo': 'conjunto.bruxa-caramelo',
  'cavaleiro-biscoito': 'conjunto.cavaleiro-biscoito',
  'feiticeira-menta': 'conjunto.feiticeira-menta',
  'brutamontes-nougat': 'conjunto.brutamontes-nougat',
  'arqueira-avela': 'conjunto.arqueira-avela',
  'ladina-amora': 'conjunto.ladina-amora',
}

export function chaveDaRaridade(tier: number): ChaveI18n {
  return ROTULO_RARIDADE[nomeDaRaridade(tier)]
}
