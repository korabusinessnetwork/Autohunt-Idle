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
  const { pedirValidacaoDeLote, ciclosPerdidosNoLote, snapshot, t } = useSessao()

  // O nível decide o bioma, e só isso: cenário e pool de inimigo. Vive num ref
  // porque o motor é criado uma vez e não pode ser recriado a cada nível novo.
  const nivel = snapshot?.jogador.nivel ?? 1
  const nivelRef = useRef(nivel)
  nivelRef.current = nivel

  // O motor não pode ser recriado a cada troca de idioma — o `t` corrente vive
  // num ref, e o canvas passa a desenhar o nome novo já no quadro seguinte.
  const tradutor = useRef(t)
  tradutor.current = t

  // A skin equipada troca o sprite do herói. Mesmo tratamento do idioma: vive
  // num ref para equipar surtir efeito no quadro seguinte, sem remontar o
  // canvas. `null` = nenhuma skin, e aí valem as três poses do personagem base.
  const skin = snapshot?.inventario.loadout.skin?.raridade ?? null
  const skinRef = useRef(skin)
  skinRef.current = skin

  useEffect(() => {
    const canvas = canvasRef.current
    if (!ativo || !canvas) return

    const renderizador = criarRenderizadorCanvas(
      canvas,
      (chave) => tradutor.current(chave),
      () => skinRef.current,
    )
    const motor = criarMotor({
      renderizador,
      aoValidarLote: pedirValidacaoDeLote,
      nivel: nivelRef.current,
    })
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

  // Subir de nível troca a zona sem recriar o motor: os inimigos vivos
  // terminam a vida deles e os próximos já nascem do pool novo. Recriar
  // descartaria a cena inteira num quadro.
  useEffect(() => {
    motorRef.current?.definirNivel(nivel)
  }, [nivel])

  // O servidor é quem sabe se um ciclo foi perdido; a cena só reage ao aviso.
  useEffect(() => {
    if (ciclosPerdidosNoLote > 0 && motorRef.current) {
      sinalizarReinicioDeCiclo(motorRef.current.estado)
    }
  }, [ciclosPerdidosNoLote])

  return canvasRef
}
