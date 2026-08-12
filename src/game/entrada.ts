// Entrada do jogador — teclado, mouse e toque.
//
// Este módulo existe porque `specs/mundo-aberto-e-modo-manual.md` inverteu a
// premissa: o jogo passou a ser manual, e o auto virou produto vendido. Até
// 2026-08-12 o projeto se orgulhava de NÃO ter listener de input nenhum.
//
// O que ele produz é INTENÇÃO, não movimento: "quer andar nesta direção",
// "quer atirar naquele ponto". Quem transforma intenção em posição é
// `mundo.ts`, e quem transforma posição em pixel é o renderizador. A separação
// é o que permite o modo auto preencher a mesma estrutura sem nenhum teclado
// envolvido.
//
// NADA AQUI VALE ECONOMICAMENTE. O servidor continua creditando por tempo
// decorrido × poder, e não sabe — nem precisa saber — se alguém estava jogando.

export interface Intencao {
  /** Direção desejada, já normalizada. Zero quando parado. */
  dx: number
  dy: number
  /** Para onde mirar, em coordenadas de MUNDO. `null` = mira automática. */
  miraX: number | null
  miraY: number | null
  /** Se o jogador está segurando o disparo. */
  atirando: boolean
}

export function intencaoParada(): Intencao {
  return { dx: 0, dy: 0, miraX: null, miraY: null, atirando: false }
}

/** Conversão de ponto da tela para ponto do mundo, fornecida pelo renderizador. */
export type ParaCoordenadaDoMundo = (clienteX: number, clienteY: number) => {
  x: number
  y: number
}

export interface Entrada {
  ler(): Intencao
  /** Instante do último input, em ms de `performance.now()`. */
  ultimoInputEm(): number
  destruir(): void
}

const TECLAS_CIMA = new Set(['w', 'W', 'ArrowUp'])
const TECLAS_BAIXO = new Set(['s', 'S', 'ArrowDown'])
const TECLAS_ESQUERDA = new Set(['a', 'A', 'ArrowLeft'])
const TECLAS_DIREITA = new Set(['d', 'D', 'ArrowRight'])

/**
 * Raio do joystick virtual, em pixels de tela. Abaixo disso o toque é
 * considerado parado — sem essa zona morta, encostar o polegar já faria o herói
 * sair andando.
 */
const RAIO_JOYSTICK = 56
const ZONA_MORTA = 10

export function criarEntrada(
  alvo: HTMLCanvasElement,
  paraMundo: ParaCoordenadaDoMundo,
): Entrada {
  const teclas = new Set<string>()
  let miraTelaX: number | null = null
  let miraTelaY: number | null = null
  let atirandoMouse = false

  // Toque: o joystick nasce onde o dedo encostou, não num canto fixo. Canto
  // fixo obriga o jogador a procurar o controle; nascer sob o dedo funciona na
  // primeira tentativa, sem tutorial (Princípio nº1).
  let toqueId: number | null = null
  let origemToqueX = 0
  let origemToqueY = 0
  let toqueX = 0
  let toqueY = 0

  let ultimoInput = 0

  function marcar(): void {
    ultimoInput = performance.now()
  }

  function aoTeclar(evento: KeyboardEvent): void {
    // Não sequestra atalho do navegador nem digitação em campo de formulário.
    if (evento.ctrlKey || evento.metaKey || evento.altKey) return
    const alvoEvento = evento.target as HTMLElement | null
    if (alvoEvento && /^(INPUT|TEXTAREA|SELECT)$/.test(alvoEvento.tagName)) return

    if (!teclas.has(evento.key)) marcar()
    teclas.add(evento.key)

    // As setas rolam a página; WASD não. Só previne o que de fato usamos.
    if (evento.key.startsWith('Arrow')) evento.preventDefault()
  }

  function aoSoltar(evento: KeyboardEvent): void {
    teclas.delete(evento.key)
  }

  /** Perder o foco solta tudo — senão o herói sai andando sozinho para sempre. */
  function aoPerderFoco(): void {
    teclas.clear()
    atirandoMouse = false
    toqueId = null
  }

  function aoMoverMouse(evento: MouseEvent): void {
    miraTelaX = evento.clientX
    miraTelaY = evento.clientY
    marcar()
  }

  function aoPressionarMouse(evento: MouseEvent): void {
    if (evento.button !== 0) return
    atirandoMouse = true
    miraTelaX = evento.clientX
    miraTelaY = evento.clientY
    marcar()
  }

  function aoSoltarMouse(): void {
    atirandoMouse = false
  }

  function aoTocarInicio(evento: TouchEvent): void {
    const toque = evento.changedTouches[0]
    if (!toque || toqueId !== null) return
    toqueId = toque.identifier
    origemToqueX = toque.clientX
    origemToqueY = toque.clientY
    toqueX = origemToqueX
    toqueY = origemToqueY
    marcar()
    evento.preventDefault()
  }

  function aoTocarMover(evento: TouchEvent): void {
    for (const toque of Array.from(evento.changedTouches)) {
      if (toque.identifier !== toqueId) continue
      toqueX = toque.clientX
      toqueY = toque.clientY
      marcar()
      evento.preventDefault()
    }
  }

  function aoTocarFim(evento: TouchEvent): void {
    for (const toque of Array.from(evento.changedTouches)) {
      if (toque.identifier === toqueId) toqueId = null
    }
  }

  window.addEventListener('keydown', aoTeclar)
  window.addEventListener('keyup', aoSoltar)
  window.addEventListener('blur', aoPerderFoco)
  alvo.addEventListener('mousemove', aoMoverMouse)
  alvo.addEventListener('mousedown', aoPressionarMouse)
  window.addEventListener('mouseup', aoSoltarMouse)
  alvo.addEventListener('touchstart', aoTocarInicio, { passive: false })
  alvo.addEventListener('touchmove', aoTocarMover, { passive: false })
  window.addEventListener('touchend', aoTocarFim)
  window.addEventListener('touchcancel', aoTocarFim)

  return {
    ler() {
      let dx = 0
      let dy = 0

      for (const tecla of teclas) {
        if (TECLAS_CIMA.has(tecla)) dy -= 1
        if (TECLAS_BAIXO.has(tecla)) dy += 1
        if (TECLAS_ESQUERDA.has(tecla)) dx -= 1
        if (TECLAS_DIREITA.has(tecla)) dx += 1
      }

      // Joystick virtual, quando há dedo na tela.
      if (toqueId !== null) {
        const tx = toqueX - origemToqueX
        const ty = toqueY - origemToqueY
        const distancia = Math.hypot(tx, ty)
        if (distancia > ZONA_MORTA) {
          const escala = Math.min(1, distancia / RAIO_JOYSTICK) / distancia
          dx += tx * escala
          dy += ty * escala
        }
      }

      // Normaliza para a diagonal não ser mais rápida que a reta — o erro
      // clássico de somar duas teclas.
      const norma = Math.hypot(dx, dy)
      if (norma > 1) {
        dx /= norma
        dy /= norma
      }

      // No toque a mira é automática: a tela pequena não comporta um segundo
      // polegar mirando, e forçar isso seria fricção (spec, 4.2).
      const usandoToque = toqueId !== null
      const temMira = !usandoToque && miraTelaX !== null && miraTelaY !== null
      const mira = temMira ? paraMundo(miraTelaX!, miraTelaY!) : null

      return {
        dx,
        dy,
        miraX: mira?.x ?? null,
        miraY: mira?.y ?? null,
        // Andar já dispara: obrigar a segurar o botão para atirar enquanto anda
        // é exigência de jogo de tiro, não de idle casual.
        atirando: atirandoMouse || usandoToque || norma > 0,
      }
    },

    ultimoInputEm() {
      return ultimoInput
    },

    destruir() {
      window.removeEventListener('keydown', aoTeclar)
      window.removeEventListener('keyup', aoSoltar)
      window.removeEventListener('blur', aoPerderFoco)
      alvo.removeEventListener('mousemove', aoMoverMouse)
      alvo.removeEventListener('mousedown', aoPressionarMouse)
      window.removeEventListener('mouseup', aoSoltarMouse)
      alvo.removeEventListener('touchstart', aoTocarInicio)
      alvo.removeEventListener('touchmove', aoTocarMover)
      window.removeEventListener('touchend', aoTocarFim)
      window.removeEventListener('touchcancel', aoTocarFim)
    },
  }
}
