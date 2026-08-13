import { useCallback, useEffect, useRef, useState } from 'react'

import { useSessao } from '../context/SessaoContext'
import { perfilDaArma } from '../game/armas'
import { criarEntrada } from '../game/entrada'
import { mapaSugerido } from '../game/mapas'
import { criarMotor, type Motor } from '../game/motor'
import { proporcaoDeVida, sinalizarReinicioDeCiclo, type ModoDeJogo } from '../game/mundo'
import { criarRenderizadorCanvas } from '../game/renderizador'

// Cola entre React e o motor.
//
// O motor NÃO é um componente React: ele roda em `requestAnimationFrame` e
// escreve direto no canvas, sem passar por estado nem re-render (ADR-001).
// Este hook só cuida do ciclo de vida — criar, iniciar, redimensionar, parar —
// e de empurrar para dentro dele o que o servidor publica: arma equipada,
// vitalidade máxima e mapa escolhido.

/**
 * Quanto tempo sem input encerra a sessão, quando o auto NÃO está destravado.
 *
 * Encerrar é a mesma rota do fechar-aba, de propósito: a partir dali valem as
 * regras de farm offline que já existem, e nenhuma regra nova precisou nascer
 * no servidor (`specs/mundo-aberto-e-modo-manual.md`, 3.2).
 *
 * Isto é ANTI-OCIOSO, não anti-cheat: pega quem levanta e sai, não quem
 * escreve um script. O captcha, que pegaria o script, foi adiado pelo dono — e
 * o buraco está registrado na spec.
 */
const TOLERANCIA_SEM_INPUT_MS = 2 * 60 * 1000

/**
 * De quanto em quanto tempo a HUD relê o mundo.
 *
 * A barra de vitalidade agora se move no meio da briga, então a HUD precisa
 * acompanhar — mas o motor não pode empurrar estado a 60fps (ADR-001). 100ms é
 * mais rápido que o olho cobra numa barra e ~6× mais barato que um quadro.
 */
const INTERVALO_DA_HUD_MS = 100

export function useMotorDeJogo(ativo: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const motorRef = useRef<Motor | null>(null)
  const { pedirValidacaoDeLote, ciclosPerdidosNoLote, snapshot, t, conectar, encerrar } =
    useSessao()

  // Com auto destravado a sessão nunca é encerrada por inatividade: é
  // exatamente o que a pessoa comprou.
  const autoDestravado =
    (snapshot?.assinatura.ativa ?? false) || (snapshot?.farm.minutosAutoSaldo ?? 0) > 0
  const autoDestravadoRef = useRef(autoDestravado)
  autoDestravadoRef.current = autoDestravado

  // O modo vive num ref pelo mesmo motivo do idioma: o motor é criado uma vez,
  // e alternar auto não pode recriar a cena.
  const modoRef = useRef<ModoDeJogo>('manual')

  const nivel = snapshot?.jogador.nivel ?? 1
  /**
   * O mapa em que o jogador está.
   *
   * Começa no mais avançado que o nível libera: chegar no nível 11 e continuar
   * na floresta porque ninguém avisou seria a fricção que o Princípio nº1
   * proíbe. Depois disso, quem manda é a escolha no painel de mapa.
   */
  const [mapaId, setMapaId] = useState(1)
  const escolheuMapa = useRef(false)
  const mapaInicial = useRef(1)

  /** Ficou parado tempo demais sem ter auto — a sessão foi encerrada. */
  const [ocioso, setOcioso] = useState(false)
  /** Proporção da vitalidade visual, para a HUD desenhar a barra. */
  const [vida, setVida] = useState(1)

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

  const arma = snapshot?.inventario.loadout.arma ?? null
  const armaId = arma?.id ?? null
  const armaTipoDano = arma?.tipoDano ?? null
  const vitalidadeMaxima = snapshot?.jogador.vitalidadeMaxima ?? 0

  useEffect(() => {
    const canvas = canvasRef.current
    if (!ativo || !canvas) return

    const renderizador = criarRenderizadorCanvas(
      canvas,
      (chave) => tradutor.current(chave),
      () => skinRef.current,
    )
    const entrada = criarEntrada(canvas, (x, y) => renderizador.paraCoordenadaDoMundo(x, y))
    const motor = criarMotor({
      renderizador,
      aoValidarLote: pedirValidacaoDeLote,
      entrada,
      mapaId: mapaInicial.current,
    })
    motor.definirModo(modoRef.current)

    const observar = window.setInterval(() => {
      setVida(proporcaoDeVida(motor.estado))

      // Trava de inatividade. Roda no mesmo intervalo porque é a mesma
      // pergunta de baixa frequência — e não precisa de precisão de quadro.
      if (autoDestravadoRef.current || modoRef.current === 'auto') return
      const parado = performance.now() - motor.ultimoInputEm()
      if (motor.ultimoInputEm() > 0 && parado > TOLERANCIA_SEM_INPUT_MS) {
        setOcioso(true)
      }
    }, INTERVALO_DA_HUD_MS)
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
      window.clearInterval(observar)
      entrada.destruir()
      motor.parar()
      renderizador.destruir()
      motorRef.current = null
    }
  }, [ativo, pedirValidacaoDeLote])

  // Primeira leitura do nível: leva o jogador para o mapa mais avançado que ele
  // já pode. Só a PRIMEIRA — depois disso, subir de nível não pode teleportar
  // ninguém no meio de uma briga.
  useEffect(() => {
    if (escolheuMapa.current || !snapshot) return
    escolheuMapa.current = true
    const sugerido = mapaSugerido(nivel).id
    mapaInicial.current = sugerido
    setMapaId(sugerido)
    motorRef.current?.definirMapa(sugerido)
  }, [snapshot, nivel])

  // A arma equipada decide o combate desde `specs/mapas-instanciados-combate-e-hud.md`.
  // Trocar de arma na mochila muda o ataque no quadro seguinte, sem remontar o
  // canvas — mesmo tratamento da skin.
  useEffect(() => {
    if (!armaId) {
      motorRef.current?.definirArma(perfilDaArma(null))
      return
    }
    motorRef.current?.definirArma(perfilDaArma({ id: armaId, tipoDano: armaTipoDano }))
  }, [armaId, armaTipoDano])

  // A barra da HUD tem a escala do servidor (`100 + nível × 10 + Vitalidade ×
  // 25`), mesmo sendo a simulação local que a move.
  useEffect(() => {
    if (vitalidadeMaxima > 0) motorRef.current?.definirVitalidadeMaxima(vitalidadeMaxima)
  }, [vitalidadeMaxima])

  // O servidor é quem sabe se um ciclo foi perdido; a cena só reage ao aviso.
  useEffect(() => {
    if (ciclosPerdidosNoLote > 0 && motorRef.current) {
      sinalizarReinicioDeCiclo(motorRef.current.estado)
    }
  }, [ciclosPerdidosNoLote])

  // Encerrar de verdade só quando o estado de ocioso liga — assim a chamada
  // acontece uma vez, e não a cada tique do observador.
  useEffect(() => {
    if (ocioso) void encerrar()
  }, [ocioso, encerrar])

  /** Liga ou desliga o auto. A decisão de PODER ligar é de quem chama. */
  const definirModo = useCallback((modo: ModoDeJogo) => {
    modoRef.current = modo
    motorRef.current?.definirModo(modo)
  }, [])

  /** Viaja para outro mapa. Quem confere o nível exigido é o painel de mapa. */
  const viajarPara = useCallback((destino: number) => {
    mapaInicial.current = destino
    setMapaId(destino)
    motorRef.current?.definirMapa(destino)
  }, [])

  /** Voltar a jogar reabre a sessão pela porta normal, com tela de retorno. */
  const retomar = useCallback(() => {
    setOcioso(false)
    void conectar()
  }, [conectar])

  return { canvasRef, definirModo, mapaId, viajarPara, vida, ocioso, retomar }
}
