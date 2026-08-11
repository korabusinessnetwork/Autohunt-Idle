import { useEffect, useRef } from 'react'

import { useSessao } from '../context/SessaoContext'
import { criarMotor, type Motor } from '../game/motor'
import { sinalizarReinicioDeCiclo } from '../game/mundo'
import { criarRenderizadorCanvas } from '../game/renderizador'

// Cola entre React e o motor.
//
// O motor NÃO é um componente React: ele roda em `requestAnimationFrame` e
// escreve direto no canvas, sem passar por estado nem re-render (ADR-001).
// Este hook só cuida do ciclo de vida — criar, iniciar, redimensionar, parar.

export function useMotorDeJogo(ativo: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const motorRef = useRef<Motor | null>(null)
  const { pedirValidacaoDeLote, ciclosPerdidosNoLote, t } = useSessao()

  // O motor não pode ser recriado a cada troca de idioma — o `t` corrente vive
  // num ref, e o canvas passa a desenhar o nome novo já no quadro seguinte.
  const tradutor = useRef(t)
  tradutor.current = t

  useEffect(() => {
    const canvas = canvasRef.current
    if (!ativo || !canvas) return

    const renderizador = criarRenderizadorCanvas(canvas, (chave) => tradutor.current(chave))
    const motor = criarMotor({ renderizador, aoValidarLote: pedirValidacaoDeLote })
    motorRef.current = motor
    motor.iniciar()

    const aoRedimensionar = () => renderizador.redimensionar()
    window.addEventListener('resize', aoRedimensionar)

    // Em portal o jogo vive num iframe que o próprio portal redimensiona, e um
    // painel abrindo também muda o espaço do canvas sem gerar `resize` de
    // janela. O observador pega os dois casos.
    const observador =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(aoRedimensionar) : null
    observador?.observe(canvas)

    return () => {
      window.removeEventListener('resize', aoRedimensionar)
      observador?.disconnect()
      motor.parar()
      renderizador.destruir()
      motorRef.current = null
    }
  }, [ativo, pedirValidacaoDeLote])

  // O servidor é quem sabe se um ciclo foi perdido; a cena só reage ao aviso.
  useEffect(() => {
    if (ciclosPerdidosNoLote > 0 && motorRef.current) {
      sinalizarReinicioDeCiclo(motorRef.current.estado)
    }
  }, [ciclosPerdidosNoLote])

  return canvasRef
}
