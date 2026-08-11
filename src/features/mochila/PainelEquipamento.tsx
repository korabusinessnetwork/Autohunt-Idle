import { useState } from 'react'

import { Botao } from '../../components/shared/Botao'
import { useSessao } from '../../context/SessaoContext'
import { nomeDaRaridade } from '../../game/regrasLoot'
import type { ChaveI18n } from '../../lib/i18n'
import { equiparItem } from '../../lib/services/itemService'
import type { ItemPossuido, SlotEquipamento, TipoDano } from '../../lib/tipos'
import { formatarNumero } from '../../utils/formato'
import { chaveDaRaridade } from './rotulos'
import './PainelEquipamento.css'

// Equipamento: 3 slots (1 arma + 2 acessórios) mais a skin.
//
// Não existe tela de classe aqui, nem em lugar nenhum — a "build" é o que
// emerge do que está equipado agora, e muda no instante em que a arma muda
// (`specs/equipamento-e-poder.md`, critério 11).
//
// A skin aparece no mesmo painel, mas com o aviso de que não muda número: é
// justamente o ponto que o critério 5 protege.

const ROTULO_SLOT: Record<SlotEquipamento, ChaveI18n> = {
  arma: 'mochila.slot.arma',
  acessorio1: 'mochila.slot.acessorio1',
  acessorio2: 'mochila.slot.acessorio2',
  skin: 'mochila.slot.skin',
}

const ROTULO_DANO: Record<TipoDano, ChaveI18n> = {
  fisico: 'dano.fisico',
  magico: 'dano.magico',
}

const ROTULO_CONJUNTO: Record<string, ChaveI18n> = {
  'bruxa-caramelo': 'conjunto.bruxa-caramelo',
  'cavaleiro-biscoito': 'conjunto.cavaleiro-biscoito',
  'feiticeira-menta': 'conjunto.feiticeira-menta',
  'brutamontes-nougat': 'conjunto.brutamontes-nougat',
}

const SLOTS: readonly SlotEquipamento[] = ['arma', 'acessorio1', 'acessorio2', 'skin']

/** Quais itens cabem em cada slot. */
function cabeNoSlot(item: ItemPossuido, slot: SlotEquipamento): boolean {
  if (slot === 'arma') return item.tipo === 'arma'
  if (slot === 'skin') return item.tipo === 'skin'
  return item.tipo === 'acessorio'
}

export function PainelEquipamento({ aoFechar }: { aoFechar: () => void }) {
  const { t, idioma, snapshot, atualizarSnapshot } = useSessao()
  const [slotAberto, setSlotAberto] = useState<SlotEquipamento>('arma')
  const [ocupado, setOcupado] = useState(false)

  const inventario = snapshot?.inventario
  const loadout = inventario?.loadout ?? {}
  const equipaveis = inventario?.equipaveis ?? []

  // Peças do conjunto mais representado entre os 3 slots de poder — a skin
  // nunca entra nessa conta.
  const conjuntos = new Map<string, number>()
  for (const slot of ['arma', 'acessorio1', 'acessorio2'] as const) {
    const id = loadout[slot]?.conjuntoId
    if (id) conjuntos.set(id, (conjuntos.get(id) ?? 0) + 1)
  }
  const [conjuntoLider, pecas] = [...conjuntos.entries()].sort((a, b) => b[1] - a[1])[0] ?? [
    null,
    0,
  ]

  const armaEquipada = loadout.arma
  const candidatos = equipaveis.filter((item) => cabeNoSlot(item, slotAberto))

  async function equipar(item: ItemPossuido) {
    setOcupado(true)
    try {
      const resposta = await equiparItem(item.id, slotAberto)
      if (resposta.data) atualizarSnapshot(resposta.data)
    } finally {
      setOcupado(false)
    }
  }

  function descrever(item: ItemPossuido) {
    const partes: string[] = [t(chaveDaRaridade(item.raridade))]
    if (item.tipoDano) partes.push(t(ROTULO_DANO[item.tipoDano]))
    if (item.afinidade) {
      partes.push(
        armaEquipada?.tipoDano === item.afinidade
          ? t('afinidade.combina')
          : t('afinidade.naoCombina'),
      )
    }
    if (item.conjuntoId && ROTULO_CONJUNTO[item.conjuntoId]) {
      partes.push(t(ROTULO_CONJUNTO[item.conjuntoId]!))
    }
    return partes.join(' · ')
  }

  return (
    <div className="equip" role="dialog" aria-modal="true" aria-labelledby="equip-titulo">
      <div className="equip__cartao">
        <h2 className="equip__titulo" id="equip-titulo">
          {t('mochila.poder', {
            poder: formatarNumero(inventario?.poderDeAtaque ?? 0, idioma),
          })}
        </h2>

        {conjuntoLider && pecas >= 2 ? (
          <p className="equip__conjunto">
            {t(ROTULO_CONJUNTO[conjuntoLider] ?? 'conjunto.bruxa-caramelo')} ·{' '}
            {t('conjunto.pecas', { pecas })} · {t(pecas >= 3 ? 'conjunto.bonus3' : 'conjunto.bonus2')}
          </p>
        ) : null}

        <div className="equip__slots">
          {SLOTS.map((slot) => {
            const item = loadout[slot]
            return (
              <button
                key={slot}
                type="button"
                className={`equip__slot ${slot === slotAberto ? 'equip__slot--ativo' : ''}`}
                onClick={() => setSlotAberto(slot)}
              >
                <span className="equip__slot-nome">{t(ROTULO_SLOT[slot])}</span>
                <span className="equip__slot-item">
                  {item
                    ? t(chaveDaRaridade(item.raridade))
                    : t('mochila.slot.vazio')}
                </span>
              </button>
            )
          })}
        </div>

        {slotAberto === 'skin' ? (
          <p className="equip__aviso">{t('mochila.semStat')}</p>
        ) : null}

        <ul className="equip__lista">
          {candidatos.map((item) => (
            <li key={item.id} className="equip__linha">
              <span className={`equip__tier equip__tier--${nomeDaRaridade(item.raridade)}`} />
              <span className="equip__descricao">{descrever(item)}</span>
              {item.slot === slotAberto ? (
                <span className="equip__emUso">{t('mochila.equipada')}</span>
              ) : (
                <Botao onClick={() => void equipar(item)} disabled={ocupado}>
                  {t('mochila.equipar')}
                </Botao>
              )}
            </li>
          ))}
        </ul>

        <Botao variante="discreta" onClick={aoFechar}>
          {t('config.fechar')}
        </Botao>
      </div>
    </div>
  )
}
