import { useState } from 'react'

import { Botao } from '../../components/shared/Botao'
import { useSessao } from '../../context/SessaoContext'
import { SLOTS_DE_PODER } from '../../game/regrasEquipamento'
import { nomeDaRaridade } from '../../game/regrasLoot'
import {
  FORTIFICACAO_MAXIMA,
  chanceDeSucesso,
  custoEmOuro,
} from '../../game/regrasFortificacao'
import type { ChaveI18n } from '../../lib/i18n'
import { equiparItem, fortificarItem } from '../../lib/services/itemService'
import type { ItemPossuido, SlotEquipamento, TipoDano } from '../../lib/tipos'
import { formatarNumero } from '../../utils/formato'
import { chaveDaRaridade, ROTULO_SLOT } from './rotulos'
import './PainelEquipamento.css'

// Equipamento: 6 slots por parte do corpo (arma, capacete, armadura, luva,
// bota, acessório) mais a skin.
//
// Não existe tela de classe aqui, nem em lugar nenhum — a "build" é o que
// emerge do que está equipado agora, e muda no instante em que a arma muda
// (`specs/equipamento-e-poder.md`, critério 11).
//
// A skin aparece no mesmo painel, mas com o aviso de que não muda número: é
// justamente o ponto que o critério 5 protege.

const ROTULO_DANO: Record<TipoDano, ChaveI18n> = {
  fisico: 'dano.fisico',
  magico: 'dano.magico',
}

const ERRO_FORT: Record<string, ChaveI18n> = {
  TETO_ATINGIDO: 'fort.erro.TETO_ATINGIDO',
  OURO_INSUFICIENTE: 'fort.erro.OURO_INSUFICIENTE',
  SEM_PEDRA: 'fort.erro.SEM_PEDRA',
  ITEM_NAO_FORTIFICAVEL: 'fort.erro.ITEM_NAO_FORTIFICAVEL',
  FORTIFICACAO_FALHOU: 'fort.erro.FORTIFICACAO_FALHOU',
}

const ROTULO_CONJUNTO: Record<string, ChaveI18n> = {
  'bruxa-caramelo': 'conjunto.bruxa-caramelo',
  'cavaleiro-biscoito': 'conjunto.cavaleiro-biscoito',
  'feiticeira-menta': 'conjunto.feiticeira-menta',
  'brutamontes-nougat': 'conjunto.brutamontes-nougat',
}

// A lista canônica de slots de poder vive nas regras; a skin é acrescentada
// aqui só para a UI, porque ela é equipável mas não entra em cálculo nenhum.
const SLOTS: readonly SlotEquipamento[] = [...SLOTS_DE_PODER, 'skin']

/** O tipo do item é o slot dele — por isso equipar não precisa informar slot. */
function cabeNoSlot(item: ItemPossuido, slot: SlotEquipamento): boolean {
  return item.tipo === slot
}

export function PainelEquipamento({ aoFechar }: { aoFechar: () => void }) {
  const { t, idioma, snapshot, atualizarSnapshot } = useSessao()
  const [slotAberto, setSlotAberto] = useState<SlotEquipamento>('arma')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<{ chave: ChaveI18n; nivel?: number } | null>(null)
  // Mutuamente exclusivas na UI: a Garantia já torna a tentativa certa, então
  // gastar a Sorte junto seria queimar uma pedra à toa (edge case do spec).
  const [pedraExtra, setPedraExtra] = useState<'nenhuma' | 'sorte' | 'garantia'>('nenhuma')

  const inventario = snapshot?.inventario
  const loadout = inventario?.loadout ?? {}
  const equipaveis = inventario?.equipaveis ?? []

  // Peças do conjunto mais representado entre os 6 slots de poder — a skin
  // nunca entra nessa conta.
  const conjuntos = new Map<string, number>()
  for (const slot of SLOTS_DE_PODER) {
    const id = loadout[slot]?.conjuntoId
    if (id) conjuntos.set(id, (conjuntos.get(id) ?? 0) + 1)
  }
  const [conjuntoLider, pecas] = [...conjuntos.entries()].sort((a, b) => b[1] - a[1])[0] ?? [
    null,
    0,
  ]

  const pedras = inventario?.pedras ?? { fortificacao: 0, sorte: 0, garantia: 0 }
  const ouro = snapshot?.jogador.moeda ?? 0
  const equipadoNoSlot = loadout[slotAberto] ?? null

  const armaEquipada = loadout.arma
  const candidatos = equipaveis.filter((item) => cabeNoSlot(item, slotAberto))

  async function equipar(item: ItemPossuido) {
    setOcupado(true)
    try {
      const resposta = await equiparItem(item.id)
      if (resposta.data) atualizarSnapshot(resposta.data)
    } finally {
      setOcupado(false)
    }
  }

  async function fortificar() {
    if (!equipadoNoSlot) return
    setOcupado(true)
    setAviso(null)
    try {
      const resposta = await fortificarItem(equipadoNoSlot.id, {
        usarSorte: pedraExtra === 'sorte',
        usarGarantia: pedraExtra === 'garantia',
      })
      if (resposta.error) {
        setAviso({ chave: ERRO_FORT[resposta.error.codigo] ?? 'fort.erro.FORTIFICACAO_FALHOU' })
        return
      }
      if (resposta.data) {
        atualizarSnapshot(resposta.data)
        const r = resposta.data.fortificacao
        setAviso(
          r?.sucesso
            ? { chave: 'fort.sucesso', nivel: r.nivelFinal }
            : { chave: 'fort.falhou' },
        )
      }
    } finally {
      setOcupado(false)
    }
  }

  function descrever(item: ItemPossuido) {
    const partes: string[] = [t(chaveDaRaridade(item.raridade))]
    if (item.fortificacao > 0) partes.push(t('fort.nivel', { nivel: item.fortificacao }))
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
            {t('conjunto.pecas', { pecas })} · {t(pecas >= 6 ? 'conjunto.bonus3' : 'conjunto.bonus2')}
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

        {/*
          Fortificação. A chance e o custo aparecem em NÚMERO antes da
          tentativa — é a restrição ética de transparência
          (`memory/restrictions.md`), não enfeite. E o aviso de que falhar não
          rebaixa o item fica sempre visível, porque é a diferença entre esta
          mecânica e a do jogo que a inspirou.
        */}
        {equipadoNoSlot && slotAberto !== 'skin' ? (
          <div className="equip__fort">
            <h3 className="equip__fort-titulo">
              {t('fort.titulo')} {t('fort.nivel', { nivel: equipadoNoSlot.fortificacao })}
            </h3>

            {equipadoNoSlot.fortificacao < FORTIFICACAO_MAXIMA ? (
              <>
                <p className="equip__fort-linha">
                  {t('fort.chance', {
                    chance:
                      pedraExtra === 'garantia'
                        ? 100
                        : Math.round(
                            chanceDeSucesso(
                              equipadoNoSlot.fortificacao,
                              pedraExtra === 'sorte',
                            ) * 100,
                          ),
                  })}
                </p>
                <p className="equip__fort-linha">
                  {t('fort.custo', {
                    ouro: formatarNumero(
                      custoEmOuro(equipadoNoSlot.fortificacao, equipadoNoSlot.raridade),
                      idioma,
                    ),
                  })}
                </p>
                <p className="equip__fort-linha">
                  {t('fort.pedras', {
                    fortificacao: pedras.fortificacao,
                    sorte: pedras.sorte,
                    garantia: pedras.garantia,
                  })}
                </p>
                <label className="equip__fort-opcao">
                  <input
                    type="checkbox"
                    checked={pedraExtra === 'sorte'}
                    disabled={ocupado || pedras.sorte < 1}
                    onChange={(e) => setPedraExtra(e.target.checked ? 'sorte' : 'nenhuma')}
                  />
                  <span>{t('fort.usarSorte')}</span>
                </label>

                <label className="equip__fort-opcao">
                  <input
                    type="checkbox"
                    checked={pedraExtra === 'garantia'}
                    disabled={ocupado || pedras.garantia < 1}
                    onChange={(e) => setPedraExtra(e.target.checked ? 'garantia' : 'nenhuma')}
                  />
                  <span>{t('fort.usarGarantia')}</span>
                </label>

                <p className="equip__fort-linha equip__fort-linha--calmo">
                  {t('fort.semPunicao')}
                </p>

                <Botao
                  variante="recompensa"
                  onClick={() => void fortificar()}
                  disabled={
                    ocupado ||
                    pedras.fortificacao < 1 ||
                    ouro < custoEmOuro(equipadoNoSlot.fortificacao, equipadoNoSlot.raridade)
                  }
                >
                  {ocupado ? t('fort.tentando') : t('fort.tentar')}
                </Botao>
              </>
            ) : (
              <p className="equip__fort-linha">{t('fort.erro.TETO_ATINGIDO')}</p>
            )}

            {aviso ? (
              <p className="equip__fort-linha" role="status">
                {t(aviso.chave, aviso.nivel !== undefined ? { nivel: aviso.nivel } : undefined)}
              </p>
            ) : null}
          </div>
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
