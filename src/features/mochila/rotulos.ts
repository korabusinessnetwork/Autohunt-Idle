import { nomeDaRaridade, type Raridade } from '../../game/regrasLoot'
import type { ChaveI18n } from '../../lib/i18n'
import type { SlotEquipamento, TipoItem } from '../../lib/tipos'

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

export function chaveDaRaridade(tier: number): ChaveI18n {
  return ROTULO_RARIDADE[nomeDaRaridade(tier)]
}
