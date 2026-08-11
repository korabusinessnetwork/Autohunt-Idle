// Sprites placeholder.
//
// A arte final foi encomendada ao Claude Design (pixel art, ver
// `docs/02_DESIGN_SYSTEM/brief-arte-claude-design.md`) e ainda não voltou. Até
// lá, cada criatura é desenhada com a silhueta que o brief descreve — é
// justamente o que ele pede que carregue a leitura ("baixa resolução força
// design guiado por silhueta"), então trocar por sprite depois é substituir
// este arquivo, sem tocar em mundo/motor/renderizador.

import type { FormaInimigo } from './mundo'
import type { Paleta } from './paleta'

function contornar(ctx: CanvasRenderingContext2D, paleta: Paleta): void {
  ctx.strokeStyle = paleta['--cor-texto']
  ctx.lineWidth = 3
  ctx.stroke()
}

/** Casquinha — triângulo, o capanga básico. */
function desenharCasquinha(ctx: CanvasRenderingContext2D, r: number, paleta: Paleta): void {
  ctx.beginPath()
  ctx.moveTo(0, r)
  ctx.lineTo(-r, -r * 0.8)
  ctx.lineTo(r, -r * 0.8)
  ctx.closePath()
  ctx.fillStyle = paleta['--cor-recompensa']
  ctx.fill()
  contornar(ctx, paleta)
}

/** Minhoca Azeda — "S" alto e fino, entediado. */
function desenharMinhoca(ctx: CanvasRenderingContext2D, r: number, paleta: Paleta): void {
  ctx.beginPath()
  ctx.moveTo(-r * 0.6, r)
  ctx.quadraticCurveTo(r, r * 0.3, -r * 0.4, -r * 0.2)
  ctx.quadraticCurveTo(-r * 1.4, -r * 0.7, r * 0.6, -r)
  ctx.strokeStyle = paleta['--cor-positivo']
  ctx.lineWidth = r * 0.9
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.lineCap = 'butt'
}

/** Rosquinha Brutamontes — anel largo, o tanque. */
function desenharRosquinha(ctx: CanvasRenderingContext2D, r: number, paleta: Paleta): void {
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = paleta['--cor-primaria']
  ctx.fill()
  contornar(ctx, paleta)

  ctx.beginPath()
  ctx.arc(0, 0, r * 0.36, 0, Math.PI * 2)
  ctx.fillStyle = paleta['--cor-fundo']
  ctx.fill()
  contornar(ctx, paleta)
}

/** Pirulito Valentão — bola no palito, pose de metido. */
function desenharPirulito(ctx: CanvasRenderingContext2D, r: number, paleta: Paleta): void {
  ctx.beginPath()
  ctx.moveTo(0, r * 0.5)
  ctx.lineTo(0, r * 1.5)
  ctx.strokeStyle = paleta['--cor-texto']
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(0, -r * 0.2, r * 0.85, 0, Math.PI * 2)
  ctx.fillStyle = paleta['--cor-secundaria']
  ctx.fill()
  contornar(ctx, paleta)
}

/** Pudim Conformado — trapézio baixo, derretendo sem pressa. */
function desenharPudim(ctx: CanvasRenderingContext2D, r: number, paleta: Paleta): void {
  ctx.beginPath()
  ctx.moveTo(-r, r * 0.7)
  ctx.lineTo(r, r * 0.7)
  ctx.lineTo(r * 0.6, -r * 0.6)
  ctx.lineTo(-r * 0.6, -r * 0.6)
  ctx.closePath()
  ctx.fillStyle = paleta['--cor-bloqueado']
  ctx.fill()
  contornar(ctx, paleta)
}

const DESENHOS: Record<
  FormaInimigo,
  (ctx: CanvasRenderingContext2D, raio: number, paleta: Paleta) => void
> = {
  casquinha: desenharCasquinha,
  minhoca: desenharMinhoca,
  rosquinha: desenharRosquinha,
  pirulito: desenharPirulito,
  pudim: desenharPudim,
}

export function desenharInimigo(
  ctx: CanvasRenderingContext2D,
  forma: FormaInimigo,
  x: number,
  y: number,
  raio: number,
  flash: number,
  paleta: Paleta,
): void {
  ctx.save()
  ctx.translate(x, y)
  if (flash > 0) ctx.globalAlpha = 0.45
  DESENHOS[forma](ctx, raio, paleta)
  ctx.restore()
}

/**
 * Herói — corpo arredondado com a antena de estrela que o brief cita como a
 * camada trocável de skin.
 */
export function desenharHeroi(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  olhandoX: number,
  piscando: boolean,
  paleta: Paleta,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(olhandoX >= 0 ? 1 : -1, 1)
  if (piscando) ctx.globalAlpha = 0.5

  ctx.beginPath()
  ctx.roundRect(-13, -13, 26, 26, 9)
  ctx.fillStyle = paleta['--cor-primaria']
  ctx.fill()
  contornar(ctx, paleta)

  // Antena de estrela (camada de skin no desenho final).
  ctx.beginPath()
  ctx.moveTo(4, -13)
  ctx.lineTo(9, -22)
  ctx.strokeStyle = paleta['--cor-texto']
  ctx.lineWidth = 2.5
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(10, -24, 4, 0, Math.PI * 2)
  ctx.fillStyle = paleta['--cor-recompensa']
  ctx.fill()
  contornar(ctx, paleta)

  // Olhos — a expressão de deboche que o brief pede.
  ctx.fillStyle = paleta['--cor-texto']
  ctx.fillRect(-6, -5, 3, 5)
  ctx.fillRect(3, -5, 3, 5)

  ctx.restore()
}

export function desenharProjetil(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  paleta: Paleta,
): void {
  ctx.beginPath()
  ctx.arc(x, y, 4, 0, Math.PI * 2)
  ctx.fillStyle = paleta['--cor-recompensa']
  ctx.fill()
}

/** Chão do bioma inicial — Floresta de Algodão-Doce. */
export function desenharCenario(
  ctx: CanvasRenderingContext2D,
  largura: number,
  altura: number,
  paleta: Paleta,
): void {
  ctx.fillStyle = paleta['--cor-fundo']
  ctx.fillRect(0, 0, largura, altura)

  ctx.fillStyle = paleta['--cor-secundaria']
  ctx.globalAlpha = 0.28
  const passo = 40
  for (let y = passo; y < altura; y += passo) {
    for (let x = ((y / passo) % 2) * (passo / 2); x < largura; x += passo) {
      ctx.beginPath()
      ctx.arc(x, y, 7, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}
