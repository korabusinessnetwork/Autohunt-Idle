// Motor do jogo — `requestAnimationFrame` puro, fora do ciclo de render do
// React (ADR-001, consequência negativa nº1: o loop não pode ser componente
// React re-renderizando a 60fps).
//
// O motor tem duas responsabilidades e nenhuma delas é decidir recompensa:
//   1. avançar e desenhar a cena;
//   2. avisar, a cada `INTERVALO_LOTE_MS`, que está na hora de o SERVIDOR
//      validar o lote (core, 15). O callback não recebe nem devolve
//      recompensa — é só um "pergunta pro servidor agora".

import { INTERVALO_LOTE_MS } from './regrasFarm'
import { avancarMundo, criarMundo, type EstadoMundo } from './mundo'
import type { Renderizador } from './renderizador'

export interface OpcoesMotor {
  renderizador: Renderizador
  /** Disparado a cada ciclo de lote. Não transporta valor: só pede validação. */
  aoValidarLote: () => void
  semente?: number
}

export interface Motor {
  estado: EstadoMundo
  iniciar(): void
  parar(): void
}

/** Passo máximo por quadro — evita a aba voltar do background e "teleportar". */
const DT_MAXIMO = 0.05

export function criarMotor({ renderizador, aoValidarLote, semente = 1 }: OpcoesMotor): Motor {
  const estado = criarMundo(semente)

  let quadro = 0
  let ultimoInstante = 0
  let acumuladoLote = 0
  let rodando = false

  function passo(instante: number): void {
    if (!rodando) return

    const dt = ultimoInstante === 0 ? 0 : Math.min((instante - ultimoInstante) / 1000, DT_MAXIMO)
    ultimoInstante = instante

    avancarMundo(estado, dt)
    renderizador.desenhar(estado)

    acumuladoLote += dt * 1000
    if (acumuladoLote >= INTERVALO_LOTE_MS) {
      acumuladoLote = 0
      aoValidarLote()
    }

    quadro = requestAnimationFrame(passo)
  }

  return {
    estado,
    iniciar() {
      if (rodando) return
      rodando = true
      ultimoInstante = 0
      acumuladoLote = 0
      quadro = requestAnimationFrame(passo)
    },
    parar() {
      rodando = false
      if (quadro) cancelAnimationFrame(quadro)
      quadro = 0
    },
  }
}
