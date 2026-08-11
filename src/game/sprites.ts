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

// ---------------------------------------------------------------------------
// Inimigos assinatura — um por bioma, oito no total.
//
// Cada um usa `cor`, que é o token `--bioma-N-assinatura` da zona corrente. É
// isso que permite ter identidade própria por bioma sem 40 desenhos: a
// silhueta é fixa, a cor vem do tema.
// ---------------------------------------------------------------------------

/** Algodão Fofo — nuvem de três bolhas, macia e lenta. */
function desenharAlgodao(ctx: CanvasRenderingContext2D, r: number, paleta: Paleta, cor: string): void {
  ctx.beginPath()
  ctx.arc(-r * 0.5, 0, r * 0.62, 0, Math.PI * 2)
  ctx.arc(r * 0.5, 0, r * 0.62, 0, Math.PI * 2)
  ctx.arc(0, -r * 0.45, r * 0.7, 0, Math.PI * 2)
  ctx.fillStyle = cor
  ctx.fill()
  contornar(ctx, paleta)
}

/** Bloco de Geleia — quadrado de cantos moles, treme mas não corre. */
function desenharGeleia(ctx: CanvasRenderingContext2D, r: number, paleta: Paleta, cor: string): void {
  ctx.beginPath()
  ctx.roundRect(-r, -r * 0.85, r * 2, r * 1.7, r * 0.55)
  ctx.fillStyle = cor
  ctx.fill()
  contornar(ctx, paleta)
  // Brilho de gelatina.
  ctx.beginPath()
  ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.28, r * 0.16, -0.5, 0, Math.PI * 2)
  ctx.fillStyle = paleta['--cor-fundo']
  ctx.globalAlpha = 0.6
  ctx.fill()
  ctx.globalAlpha = 1
}

/** Caco de Toffee — losango afiado, rápido e quebradiço. */
function desenharToffee(ctx: CanvasRenderingContext2D, r: number, paleta: Paleta, cor: string): void {
  ctx.beginPath()
  ctx.moveTo(0, -r)
  ctx.lineTo(r * 0.75, 0)
  ctx.lineTo(0, r)
  ctx.lineTo(-r * 0.75, 0)
  ctx.closePath()
  ctx.fillStyle = cor
  ctx.fill()
  contornar(ctx, paleta)
}

/** Concha Chiclete — espiral aberta, do recife. */
function desenharConcha(ctx: CanvasRenderingContext2D, r: number, paleta: Paleta, cor: string): void {
  ctx.beginPath()
  ctx.arc(0, 0, r, 0.5, Math.PI * 1.9)
  ctx.lineTo(0, 0)
  ctx.closePath()
  ctx.fillStyle = cor
  ctx.fill()
  contornar(ctx, paleta)

  ctx.beginPath()
  ctx.arc(0, 0, r * 0.5, 0.5, Math.PI * 1.6)
  ctx.strokeStyle = paleta['--cor-texto']
  ctx.lineWidth = 2
  ctx.stroke()
}

/** Trufa Pesada — círculo denso com topo achatado, o tanque da montanha. */
function desenharTrufa(ctx: CanvasRenderingContext2D, r: number, paleta: Paleta, cor: string): void {
  ctx.beginPath()
  ctx.arc(0, r * 0.1, r, Math.PI * 0.85, Math.PI * 2.15)
  ctx.closePath()
  ctx.fillStyle = cor
  ctx.fill()
  contornar(ctx, paleta)

  ctx.beginPath()
  ctx.moveTo(-r * 0.55, -r * 0.5)
  ctx.lineTo(r * 0.55, -r * 0.5)
  ctx.strokeStyle = paleta['--cor-texto']
  ctx.lineWidth = 3
  ctx.stroke()
}

/** Floco Gelado — estrela de seis pontas, o mais rápido do jogo. */
function desenharFloco(ctx: CanvasRenderingContext2D, r: number, paleta: Paleta, cor: string): void {
  ctx.strokeStyle = cor
  ctx.lineWidth = r * 0.34
  ctx.lineCap = 'round'
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3
    ctx.beginPath()
    ctx.moveTo(-Math.cos(a) * r, -Math.sin(a) * r)
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    ctx.stroke()
  }
  ctx.lineCap = 'butt'

  // Núcleo escuro: sem ele a estrela some no fundo claro da geleira.
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2)
  ctx.fillStyle = paleta['--cor-texto']
  ctx.fill()
}

/** Brasa de Goma — gota invertida, do vulcão. */
function desenharBrasa(ctx: CanvasRenderingContext2D, r: number, paleta: Paleta, cor: string): void {
  ctx.beginPath()
  ctx.moveTo(0, -r * 1.15)
  ctx.quadraticCurveTo(r, -r * 0.1, r * 0.55, r * 0.6)
  ctx.arc(0, r * 0.6, r * 0.55, 0, Math.PI)
  ctx.quadraticCurveTo(-r, -r * 0.1, 0, -r * 1.15)
  ctx.closePath()
  ctx.fillStyle = cor
  ctx.fill()
  contornar(ctx, paleta)
}

/** Confete Cósmico — triângulo invertido com brilho, o endgame. */
function desenharConfete(ctx: CanvasRenderingContext2D, r: number, paleta: Paleta, cor: string): void {
  ctx.beginPath()
  ctx.moveTo(0, r)
  ctx.lineTo(r, -r * 0.6)
  ctx.lineTo(-r, -r * 0.6)
  ctx.closePath()
  ctx.fillStyle = cor
  ctx.fill()
  contornar(ctx, paleta)

  ctx.beginPath()
  ctx.arc(0, -r * 0.1, r * 0.22, 0, Math.PI * 2)
  ctx.fillStyle = paleta['--cor-recompensa']
  ctx.fill()
}

const DESENHOS: Record<
  FormaInimigo,
  (ctx: CanvasRenderingContext2D, raio: number, paleta: Paleta, cor: string) => void
> = {
  casquinha: desenharCasquinha,
  minhoca: desenharMinhoca,
  rosquinha: desenharRosquinha,
  pirulito: desenharPirulito,
  pudim: desenharPudim,
  algodao: desenharAlgodao,
  geleia: desenharGeleia,
  toffee: desenharToffee,
  concha: desenharConcha,
  trufa: desenharTrufa,
  floco: desenharFloco,
  brasa: desenharBrasa,
  confete: desenharConfete,
}

export function desenharInimigo(
  ctx: CanvasRenderingContext2D,
  forma: FormaInimigo,
  x: number,
  y: number,
  raio: number,
  flash: number,
  paleta: Paleta,
  corAssinatura: string,
): void {
  ctx.save()
  ctx.translate(x, y)
  if (flash > 0) ctx.globalAlpha = 0.45
  DESENHOS[forma](ctx, raio, paleta, corAssinatura)
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

/**
 * Chão do bioma.
 *
 * As três alavancas da escalada visual dentro de um bioma (critério 2 da spec
 * de origem) são: densidade e tamanho de inimigo, que vivem em `mundo.ts`, e a
 * saturação/densidade do cenário, que é esta função. Nenhuma delas exige arte
 * nova — o tileset do bioma é o mesmo nos 5 blocos.
 */
export function desenharCenario(
  ctx: CanvasRenderingContext2D,
  largura: number,
  altura: number,
  paleta: Paleta,
  bioma: number,
  intensidade: number,
): void {
  ctx.fillStyle = paleta[`--bioma-${bioma}-fundo`] ?? paleta['--cor-fundo']
  ctx.fillRect(0, 0, largura, altura)

  ctx.fillStyle = paleta[`--bioma-${bioma}-detalhe`] ?? paleta['--cor-secundaria']
  // Mais saturado e mais denso conforme o bloco avança: o 5º bloco de um bioma
  // é visivelmente mais carregado que o 1º, com o mesmo tema.
  ctx.globalAlpha = 0.22 + intensidade * 0.3
  const passo = 44 - Math.round(intensidade * 14)
  const raio = 6 + intensidade * 3

  for (let y = passo; y < altura; y += passo) {
    for (let x = ((y / passo) % 2) * (passo / 2); x < largura; x += passo) {
      ctx.beginPath()
      ctx.arc(x, y, raio, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}
