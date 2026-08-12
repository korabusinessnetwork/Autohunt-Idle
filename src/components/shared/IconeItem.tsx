import { ARTE_SLOT_VAZIO, arteDoItem, urlDaArte } from '../../game/atlas'
import { nomeDaRaridade } from '../../game/regrasLoot'
import type { SlotEquipamento, TipoDano, TipoItem } from '../../lib/tipos'
import './IconeItem.css'

// O ícone de um item, com a moldura da raridade.
//
// Existe como componente único (e não como `<img>` espalhado pelos painéis)
// porque a moldura de raridade é regra de leitura do jogo, não decoração: o
// jogador precisa reconhecer "isso é épico" pela cor, do mesmo jeito, na
// mochila, no equipamento e na trilha do passe.
//
// Nunca quebra a tela: item sem arte no pacote (as três pedras) devolve `null`,
// e quem chama continua mostrando o rótulo de texto que já mostrava.

interface Props {
  tipo: TipoItem
  raridade: number
  /** Id do item, quando existe. Escolhe a família do desenho — ver `atlas.ts`. */
  id?: string
  tipoDano?: TipoDano | null
  /** Lado do ícone em pixels. */
  tamanho?: number
}

export function IconeItem({ tipo, raridade, id = '', tipoDano = null, tamanho = 40 }: Props) {
  const caminho = arteDoItem(tipo, raridade, id, tipoDano)
  if (!caminho) return null

  return (
    <img
      className={`icone-item icone-item--${nomeDaRaridade(raridade)}`}
      src={urlDaArte(caminho)}
      // Decorativo de propósito: o nome do tipo e o da raridade estão em texto
      // ao lado. Um `alt` aqui faria o leitor de tela repetir os dois.
      alt=""
      width={tamanho}
      height={tamanho}
      loading="lazy"
      draggable={false}
    />
  )
}

/**
 * O ícone do slot quando ele está vazio.
 *
 * Desenho apagado e contorno tracejado: o slot precisa ler como "cabe uma peça
 * aqui", não como "tem uma peça aqui". Sem essa distinção, um slot vazio e um
 * item comum ficam parecidos demais no canto do olho.
 */
export function IconeSlotVazio({
  slot,
  tamanho = 40,
}: {
  slot: SlotEquipamento
  tamanho?: number
}) {
  return (
    <img
      className="icone-item icone-item--vazio"
      src={urlDaArte(ARTE_SLOT_VAZIO[slot])}
      alt=""
      width={tamanho}
      height={tamanho}
      loading="lazy"
      draggable={false}
    />
  )
}
