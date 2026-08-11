// Renderização — atrás de uma interface, de propósito.
//
// A decisão D3 do spec de build trocou PixiJS por Canvas 2D nativo: o MVP
// desenha meia dúzia de sprites chapados, sem shader nem batching, e PixiJS
// custaria bundle e uma dependência nova para nada. Esta interface é o seguro:
// se o conteúdo crescer, entra um `RenderizadorPixi` implementando o mesmo
// contrato e nem `motor.ts` nem `mundo.ts` mudam.

import { ALTURA_MUNDO, LARGURA_MUNDO, type EstadoMundo } from './mundo'
import { lerPaleta, type Paleta } from './paleta'
import { desenharCenario, desenharHeroi, desenharInimigo, desenharProjetil } from './sprites'

export interface Renderizador {
  desenhar(estado: EstadoMundo): void
  redimensionar(): void
  destruir(): void
}

export function criarRenderizadorCanvas(canvas: HTMLCanvasElement): Renderizador {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('CANVAS_2D_INDISPONIVEL')

  let paleta: Paleta = lerPaleta(document.documentElement)

  function redimensionar(): void {
    const escala = Math.min(
      canvas.clientWidth / LARGURA_MUNDO,
      canvas.clientHeight / ALTURA_MUNDO,
    )
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(canvas.clientWidth * dpr)
    canvas.height = Math.round(canvas.clientHeight * dpr)
    ctx!.setTransform(escala * dpr, 0, 0, escala * dpr, 0, 0)
    paleta = lerPaleta(document.documentElement)
  }

  redimensionar()

  return {
    desenhar(estado) {
      desenharCenario(ctx, LARGURA_MUNDO, ALTURA_MUNDO, paleta)

      for (const inimigo of estado.inimigos) {
        desenharInimigo(
          ctx,
          inimigo.especie.forma,
          inimigo.x,
          inimigo.y,
          inimigo.especie.raio,
          inimigo.flash,
          paleta,
        )
      }

      for (const projetil of estado.projeteis) {
        desenharProjetil(ctx, projetil.x, projetil.y, paleta)
      }

      // Pisca no reinício de ciclo — sinal visual de que o servidor reportou
      // Vitalidade zerada. Sem tela de morte, sem interrupção.
      const piscando = estado.reinicioCiclo > 0 && Math.floor(estado.reinicioCiclo * 10) % 2 === 0
      desenharHeroi(ctx, estado.heroiX, estado.heroiY, estado.heroiOlhandoX, piscando, paleta)
    },
    redimensionar,
    destruir() {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    },
  }
}
