// Sprites — a arte real, com as silhuetas como rede de segurança.
//
// A arte voltou do Claude Design em 2026-08-12 e entrou pelo `atlas.ts`. As
// silhuetas geométricas que este arquivo desenhava continuam aqui, e NÃO são
// código morto: são o que aparece enquanto o PNG carrega, e o que continua
// aparecendo se ele nunca carregar. O jogo nunca fica sem cena.
//
// Foi essa separação que tornou a troca barata: `mundo.ts` e `motor.ts` não
// mudaram uma linha por causa da arte.

import {
  arteDoDanoDoInimigo,
  arteDoHeroi,
  arteDoInimigo,
  arteDoProp,
  imagem,
  type PoseHeroi,
} from './atlas'
import type { FormaInimigo } from './mundo'
import type { Paleta } from './paleta'

function contornar(ctx: CanvasRenderingContext2D, paleta: Paleta): void {
  ctx.strokeStyle = paleta['--cor-contorno']
  ctx.lineWidth = 3
  ctx.stroke()
}

// ---------------------------------------------------------------------------
// Desenho de pixel art
// ---------------------------------------------------------------------------

/**
 * Quantos pixels de mundo vale um pixel lógico da arte.
 *
 * Os PNGs vieram em "escala 8" (cada pixel do desenho é um bloco 8×8 no
 * arquivo), padronizada na rodada 2 do brief justamente para tudo dividir pela
 * mesma grade — ver `docs/02_DESIGN_SYSTEM/brief-arte-correcao.md`.
 */
const ESCALA_EXPORTACAO = 8

/**
 * Props são desenhados maiores que qualquer ator, de propósito.
 *
 * Na escala 2 eles saíam com 16–44px de altura e os inimigos com 34–47px — ou
 * seja, cenário e criatura do mesmo tamanho, e o olho passava a confundir os
 * dois. Ficar atrás não bastava para separar; tamanho separa.
 */
const ESCALA_PROP = 3

/** Sprite carregado ou silhueta gerada — `drawImage` aceita os dois. */
type Desenhavel = HTMLImageElement | HTMLCanvasElement

function proporcao(img: Desenhavel): number {
  return img instanceof HTMLCanvasElement
    ? img.width / img.height
    : img.naturalWidth / img.naturalHeight
}

/**
 * Desenha um sprite centrado, com a grade de pixel preservada.
 *
 * `imageSmoothingEnabled = false` é o que separa pixel art de borrão: sem isso
 * o navegador interpola na ampliação e devolve exatamente o anti-aliasing que
 * o brief proíbe.
 */
function desenharSprite(
  ctx: CanvasRenderingContext2D,
  img: Desenhavel,
  x: number,
  y: number,
  altura: number,
  espelhar = false,
): void {
  const largura = altura * proporcao(img)
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.translate(x, y)
  if (espelhar) ctx.scale(-1, 1)
  ctx.drawImage(img, -largura / 2, -altura / 2, largura, altura)
  ctx.restore()
}

/**
 * Silhueta chapada de um sprite, gerada uma vez e guardada.
 *
 * Os 5 inimigos base vieram com a silhueta desenhada à mão (`-sil`); os 8
 * assinatura, não. Em vez de deixar o lampejo de dano inconsistente entre eles,
 * a silhueta que falta é gerada do próprio sprite: `source-atop` pinta só onde
 * já existe pixel, que é a definição de silhueta.
 */
const silhuetas = new Map<string, HTMLCanvasElement>()

function silhuetaDe(chave: string, img: HTMLImageElement, cor: string): HTMLCanvasElement | null {
  const guardada = silhuetas.get(chave)
  if (guardada) return guardada
  if (typeof document === 'undefined') return null

  const tela = document.createElement('canvas')
  tela.width = img.naturalWidth
  tela.height = img.naturalHeight
  const ctx = tela.getContext('2d')
  if (!ctx) return null

  ctx.drawImage(img, 0, 0)
  ctx.globalCompositeOperation = 'source-atop'
  ctx.fillStyle = cor
  ctx.fillRect(0, 0, tela.width, tela.height)

  silhuetas.set(chave, tela)
  return tela
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

/**
 * Altura do sprite em pixels de mundo.
 *
 * Derivada do raio — que é o número que `mundo.ts` já usa para colisão e que a
 * intensidade do bloco faz crescer. Amarrar o desenho a ele é o que mantém
 * sprite e hitbox no mesmo tamanho sem um segundo número para desencontrar.
 */
function alturaDoSprite(raio: number): number {
  return raio * 2.6
}

/**
 * O herói não tem raio — não colide com nada, porque o mundo aberto é
 * simulação visual e a derrota vem do servidor. Então a altura é fixa, acima do
 * inimigo médio (40px), que é o que faz ele ler como protagonista.
 *
 * Fica abaixo do tanque nos blocos altos, e isso é deliberado: o inimigo cresce
 * com o bloco (`mundo.ts`), e é essa diferença que faz a zona avançada parecer
 * mais perigosa sem nenhuma arte nova.
 */
const ALTURA_HEROI = 48

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
  const caminho = arteDoInimigo(forma)
  const img = imagem(caminho)

  if (img) {
    const altura = alturaDoSprite(raio)
    if (flash > 0) {
      // Silhueta desenhada à mão quando o pacote trouxe uma; gerada quando não.
      const desenhada = arteDoDanoDoInimigo(forma)
      const sil = (desenhada && imagem(desenhada)) || silhuetaDe(caminho, img, paleta['--cor-texto'])
      if (sil) {
        desenharSprite(ctx, sil, x, y, altura)
        return
      }
    }
    desenharSprite(ctx, img, x, y, altura)
    return
  }

  // Sem PNG pronto: a silhueta geométrica, que é o estado inicial de todo
  // primeiro quadro e o permanente se a arte não carregar.
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
  pose: PoseHeroi = 'parado',
  raridadeDaSkin: number | null = null,
): void {
  const img = imagem(arteDoHeroi(pose, raridadeDaSkin))
  if (img) {
    // O sprite olha para a direita; espelhar é o que dá as duas direções sem
    // um segundo desenho.
    ctx.save()
    if (piscando) ctx.globalAlpha = 0.5
    desenharSprite(ctx, img, x, y, ALTURA_HEROI, olhandoX < 0)
    ctx.restore()
    return
  }

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
 * Chão do bioma, em coordenadas de MUNDO.
 *
 * Desde `specs/mundo-aberto-e-modo-manual.md` o mapa é muito maior que a tela,
 * então o cenário não pode mais ser desenhado "na viewport": ele é ladrilhado
 * pelo mundo, e a câmera passa por cima. Se ficasse preso à tela, andar não
 * moveria o chão — e o mundo pareceria uma esteira.
 *
 * Só os ladrilhos que tocam a área visível são desenhados.
 */
const LADO_LADRILHO = 320

export function desenharCenario(
  ctx: CanvasRenderingContext2D,
  origemX: number,
  origemY: number,
  largura: number,
  altura: number,
  paleta: Paleta,
  bioma: number,
  intensidade: number,
): void {
  ctx.fillStyle = paleta[`--bioma-${bioma}-fundo`] ?? paleta['--cor-fundo']
  ctx.fillRect(origemX, origemY, largura, altura)

  // O CHÃO É PROCEDURAL, e não o PNG do bioma. Não é economia: `sc-*.png` tem
  // 608×352 e é um CENÁRIO DE FUNDO — tem horizonte, profundidade e um chão na
  // parte de baixo. Foi desenhado para a arena de tela fixa que existia antes
  // de `specs/mundo-aberto-e-modo-manual.md`.
  //
  // Ladrilhar um cenário de fundo num mundo top-down produz faixa de horizonte
  // repetida e árvore cortada em grade — vira papel de parede, não lugar. O
  // chão de um jogo visto de cima precisa ser TEXTURA, e textura é o que esta
  // função desenha, na paleta do bioma.
  //
  // Os PNGs de prop continuam entrando: eles são objetos, e objeto visto de
  // cima funciona. Quem some é só o fundo.
  ctx.fillStyle = paleta[`--bioma-${bioma}-detalhe`] ?? paleta['--cor-secundaria']
  ctx.globalAlpha = 0.16 + intensidade * 0.16
  const passo = 34 - Math.round(intensidade * 8)
  const raio = 4 + intensidade * 2.5

  const inicioY = Math.floor(origemY / passo) * passo
  const inicioX = Math.floor(origemX / passo) * passo
  for (let y = inicioY; y < origemY + altura + passo; y += passo) {
    const desloca = (Math.floor(y / passo) % 2) * (passo / 2)
    for (let x = inicioX + desloca; x < origemX + largura + passo; x += passo) {
      ctx.beginPath()
      ctx.arc(x, y, raio, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1

  const primeiroX = Math.floor(origemX / LADO_LADRILHO)
  const ultimoX = Math.floor((origemX + largura) / LADO_LADRILHO)
  const primeiroY = Math.floor(origemY / LADO_LADRILHO)
  const ultimoY = Math.floor((origemY + altura) / LADO_LADRILHO)

  for (let ty = primeiroY; ty <= ultimoY; ty++) {
    for (let tx = primeiroX; tx <= ultimoX; tx++) {
      desenharProps(ctx, tx, ty, bioma, intensidade)
    }
  }
}

/**
 * Os elementos de mundo do bioma, ancorados no ladrilho.
 *
 * A posição é derivada do índice do LADRILHO, nunca sorteada — é o que faz o
 * mesmo pedaço do mapa ter sempre os mesmos props. Prop que muda de lugar
 * quando o jogador volta destruiria a sensação de lugar, que é justamente o
 * ponto desta rodada.
 */
function desenharProps(
  ctx: CanvasRenderingContext2D,
  ladrilhoX: number,
  ladrilhoY: number,
  bioma: number,
  intensidade: number,
): void {
  const prop = imagem(arteDoProp(bioma))
  if (!prop) return

  const alturaProp = (prop.naturalHeight / ESCALA_EXPORTACAO) * ESCALA_PROP
  const baseX = ladrilhoX * LADO_LADRILHO
  const baseY = ladrilhoY * LADO_LADRILHO
  // Hash do ladrilho: determinístico, então o mesmo pedaço do mapa tem sempre
  // os mesmos props. Prop que muda de lugar quando o jogador volta destrói a
  // sensação de lugar, que é o ponto da rodada.
  const hash = Math.abs(Math.sin(ladrilhoX * 12.9898 + ladrilhoY * 78.233 + bioma) * 43758.5453)
  const sorteio = hash - Math.floor(hash)

  // Nem todo ladrilho tem prop: densidade uniforme vira grade, e grade denuncia
  // que o mundo é gerado. A intensidade da região decide quantos aparecem.
  if (sorteio > 0.35 + intensidade * 0.3) return

  const desloca = (n: number) => {
    const h = Math.abs(Math.sin(ladrilhoX * 3.7 + ladrilhoY * 9.1 + n) * 1234.5678)
    return h - Math.floor(h)
  }

  ctx.save()
  ctx.imageSmoothingEnabled = false
  const x = baseX + LADO_LADRILHO * (0.2 + desloca(1) * 0.6)
  const y = baseY + LADO_LADRILHO * (0.2 + desloca(2) * 0.6)
  desenharSprite(ctx, prop, x, y, alturaProp, desloca(3) > 0.5)
  ctx.restore()
}
