import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as EventoDePonteiro,
  type ReactNode,
} from 'react'

import { IconeItem } from '../../components/shared/IconeItem'
import type { ItemPossuido, SlotEquipamento } from '../../lib/tipos'
import './ArrasteDeItem.css'

// Arrastar da mochila até o slot para vestir (pedido do dono, 2026-08-13).
//
// POR QUE EVENTO DE PONTEIRO, e não a API de arrastar do HTML: `draggable` +
// `dragstart` simplesmente NÃO EXISTE no celular. Autohunt Idle é um jogo casual
// que vai ser jogado no telefone; entregar um gesto que só funciona com mouse
// seria entregar metade do pedido. Evento de ponteiro é o mesmo código para
// dedo, mouse e caneta.
//
// O arraste é SEMPRE um atalho, nunca o único caminho: cada peça continua com
// botão de equipar do lado. Quem descobre o gesto ganha velocidade; quem não
// descobre não perde nada — que é o Princípio nº 1 aplicado a gesto.

/** Quantos pixels o dedo precisa andar até virar arraste em vez de toque. */
const LIMIAR = 6

interface EstadoArraste {
  item: ItemPossuido
  x: number
  y: number
  /** Passou do limiar. Antes disso ainda pode acabar sendo um toque comum. */
  arrastando: boolean
  /** Slot compatível sob o ponteiro agora, se houver. */
  alvo: SlotEquipamento | null
}

export interface Arraste {
  /** A peça em arraste neste instante — `null` quando ninguém está arrastando. */
  itemArrastado: ItemPossuido | null
  /** O slot que aceitaria a peça se ela fosse solta agora. */
  slotAlvo: SlotEquipamento | null
  /** Ligar no `onPointerDown` da linha que pode ser arrastada. */
  comecar: (item: ItemPossuido, evento: EventoDePonteiro<HTMLElement>) => void
  /** O desenho que acompanha o dedo. Quem chama decide onde renderizar. */
  fantasma: ReactNode
}

const ARRASTE_PARADO: Arraste = {
  itemArrastado: null,
  slotAlvo: null,
  comecar: () => {},
  fantasma: null,
}

const ContextoDeArraste = createContext<Arraste>(ARRASTE_PARADO)

/** Para quem só precisa saber o que está sendo arrastado (os slots). */
export function useArrasteDeItem(): Arraste {
  return useContext(ContextoDeArraste)
}

export function ProvedorDeArraste({ valor, children }: { valor: Arraste; children: ReactNode }) {
  return <ContextoDeArraste.Provider value={valor}>{children}</ContextoDeArraste.Provider>
}

/**
 * O slot só aceita a peça do tipo dele — o tipo do item É o slot dele
 * (`lib/tipos.ts`). Nada de soltar bota no lugar do capacete: prevenção de erro
 * vale mais que mensagem de erro (CLAUDE.md).
 */
function slotSobOPonteiro(x: number, y: number, item: ItemPossuido): SlotEquipamento | null {
  const elemento = document.elementFromPoint(x, y)?.closest('[data-slot]')
  const slot = elemento?.getAttribute('data-slot') as SlotEquipamento | null
  return slot && slot === item.tipo ? slot : null
}

/**
 * O estado do arraste. É hook e não componente de propósito: assim o painel que
 * o cria também CONSOME o valor (as linhas arrastáveis moram nele), sem
 * precisar se partir em dois só para ficar embaixo do próprio provedor.
 */
export function useEstadoDeArraste(
  aoSoltar: (item: ItemPossuido, slot: SlotEquipamento) => void,
): Arraste {
  const [estado, setEstado] = useState<EstadoArraste | null>(null)

  // Espelhos em ref: os ouvintes vivem na janela e são registrados uma vez por
  // arraste. Sem o espelho, eles enxergariam o estado do primeiro quadro.
  const estadoRef = useRef<EstadoArraste | null>(null)
  estadoRef.current = estado
  const aoSoltarRef = useRef(aoSoltar)
  aoSoltarRef.current = aoSoltar
  const origem = useRef({ x: 0, y: 0 })

  const comecar = useCallback((item: ItemPossuido, evento: EventoDePonteiro<HTMLElement>) => {
    // Botão do meio/direito não arrasta, e clique em controle é clique: sem
    // esta guarda, apertar "Equipar" dentro da linha viraria arraste.
    if (evento.button > 0) return
    if ((evento.target as HTMLElement).closest('button, a, input, label, summary')) return

    origem.current = { x: evento.clientX, y: evento.clientY }
    setEstado({ item, x: evento.clientX, y: evento.clientY, arrastando: false, alvo: null })
  }, [])

  const ativo = estado !== null

  useEffect(() => {
    if (!ativo) return

    function mover(evento: PointerEvent) {
      const atual = estadoRef.current
      if (!atual) return

      const andou = Math.hypot(evento.clientX - origem.current.x, evento.clientY - origem.current.y)
      const arrastando = atual.arrastando || andou > LIMIAR

      setEstado({
        ...atual,
        x: evento.clientX,
        y: evento.clientY,
        arrastando,
        alvo: arrastando ? slotSobOPonteiro(evento.clientX, evento.clientY, atual.item) : null,
      })
    }

    function soltar(evento: PointerEvent) {
      const atual = estadoRef.current
      setEstado(null)
      // Não passou do limiar: foi um toque, e toque não equipa nada. Equipar
      // sem querer é o erro caro desta tela — desfazer exige achar a peça
      // anterior de novo.
      if (!atual?.arrastando) return

      const slot = slotSobOPonteiro(evento.clientX, evento.clientY, atual.item)
      if (slot) aoSoltarRef.current(atual.item, slot)
    }

    function cancelar() {
      setEstado(null)
    }

    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', cancelar)
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', cancelar)
    }
  }, [ativo])

  const arrastando = estado?.arrastando ? estado : null

  return {
    itemArrastado: arrastando?.item ?? null,
    slotAlvo: arrastando?.alvo ?? null,
    comecar,
    /*
      O fantasma que acompanha o dedo. Sem ele o arraste é invisível e o jogador
      larga no meio do caminho achando que não pegou.

      A posição vai por variável CSS, não por `style` de aparência: o estilo
      continua morando no CSS (CLAUDE.md), aqui passa só o dado.
    */
    fantasma: arrastando ? (
      <div
        className="arraste-fantasma"
        aria-hidden="true"
        style={
          {
            '--arraste-x': `${arrastando.x}px`,
            '--arraste-y': `${arrastando.y}px`,
          } as CSSProperties
        }
      >
        <IconeItem
          tipo={arrastando.item.tipo}
          raridade={arrastando.item.raridade}
          id={arrastando.item.id}
          tipoDano={arrastando.item.tipoDano}
          tamanho={48}
        />
      </div>
    ) : null,
  }
}
