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
 *
 * Subiu para 4 em 2026-08-13, junto com a viewport maior e o herói menor: a
 * mesma mudança pelos dois lados. O ator encolheu na tela, e o cenário cresceu
 * no mundo, então o mapa passou a parecer um lugar grande em vez de um fundo
 * atrás de um boneco.
 */
const ESCALA_PROP = 4

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
 * inimigo médio (~37px), que é o que faz ele ler como protagonista.
 *
 * Fica abaixo do tanque nos blocos altos, e isso é deliberado: o inimigo cresce
 * com o bloco (`mundo.ts`), e é essa diferença que faz a zona avançada parecer
 * mais perigosa sem nenhuma arte nova.
 *
 * Caiu de 48 para 42 em 2026-08-13, junto com a viewport maior. Os dois efeitos
 * se somam: na tela o herói ficou ~30% menor. Não caiu mais do que isso porque
 * abaixo de ~40 ele passa a ler como mais um bicho do mapa em vez de
 * protagonista — e a margem para o inimigo médio é o que sustenta essa leitura.
 */
const ALTURA_HEROI = 42

// ---------------------------------------------------------------------------
// Movimento procedural do herói
//
// POR QUE ISTO EXISTE: a arte veio com TRÊS poses de herói e UMA pose por skin.
// Enquanto não havia skin equipada, trocar de PNG dava a ilusão de animação;
// equipar qualquer skin colapsava os três estados num arquivo só e o boneco
// parava de reagir — e a skin mais barata do jogo (`sk-base.png`) é byte a byte
// igual à pose parada, então ela só desligava a animação sem trocar nada.
//
// A saída é movimento gerado por transform, que independe de quantos PNGs a
// skin tem: o mesmo balanço vale com skin e sem skin. Arte de pose dedicada por
// skin continua sendo melhoria possível, nunca pré-requisito (CLAUDE.md manda
// adiar gasto enquanto o projeto é pré-receita).
//
// AS AMPLITUDES SÃO PEQUENAS DE PROPÓSITO, e vivem aqui em vez de `ajustes.ts`
// (que exigiria migration por paridade) ou de `regras*.ts` (que cobraria um par
// no Postgres que não deve existir): nada disto vale economicamente, é desenho.
// ---------------------------------------------------------------------------

/**
 * Quanto o corpo sobe no meio do passo, em pixels de MUNDO.
 *
 * Três, e não mais: o balanço é referência de que o herói está andando, não
 * acrobacia. Acima disso o boneco descola do chão e a leitura vira "flutuando".
 */
const AMPLITUDE_DO_BOB = 3

/**
 * Quanto o herói avança na direção do golpe, em pixels de MUNDO.
 *
 * DECISÃO CONSCIENTE, e o motivo de o número ser tão baixo: o golpe e o
 * projétil nascem e são desenhados na posição REAL do herói (`mundo.ts`), que
 * este deslocamento não toca. Manter o avanço em 3 px contra um arco de dezenas
 * de pixels deixa a diferença abaixo do perceptível — o arco continua saindo da
 * mão. A alternativa (empurrar o mesmo offset para dentro do golpe) foi
 * descartada por duplicar a conta em dois arquivos para ganhar nada.
 */
const AVANCO_DO_ATAQUE = 3

/** Pulinho da comemoração, em pixels de MUNDO. É o que dá o tom pastelão. */
const ALTURA_DO_PULO = 4

/**
 * O que o herói está fazendo agora, para efeito de DESENHO.
 *
 * NÃO TEM CAMPO DE SKIN, e isso não é descuido: "skin nunca tem stat" é
 * estrutural neste projeto, e a forma mais fácil de furar essa regra seria uma
 * skin cósmica que pula mais alto que a comum. Sem o argumento, a regressão é
 * impossível por construção — não há o que ler.
 */
export interface MovimentoDoHeroi {
  pose: PoseHeroi
  /**
   * Quanto RESTA da pose corrente, de 1 (acabou de começar) a 0 (terminou).
   *
   * É "restante" e não "decorrido" para falar a mesma língua de
   * `desenharGolpe`, que já recebe `vida / duração` com esse nome. Duas
   * convenções de progresso no mesmo arquivo seria a próxima armadilha.
   */
  progresso: number
  /** Onde o herói está no ciclo de passo, em CICLOS. Um passo inteiro = 1. */
  faseDoPasso: number
  /** Para que lado o herói olha. Só o sinal importa. */
  olhandoX: number
}

/**
 * Deslocamento de DESENHO do herói, em pixels de mundo.
 *
 * Puro e sem estado: quem guarda a fase é `mundo.ts`, quem guarda o tempo da
 * pose também. Aqui só se converte "o que está acontecendo" em "quantos pixels
 * para o lado e para cima".
 *
 * O resultado é INTEIRO por contrato. A escala do renderizador já é fracionária
 * e `imageSmoothingEnabled` está desligado, então offset fracionário muda quais
 * linhas do sprite somem a cada quadro e o detalhe interno "anda" sozinho — lê
 * como sprite quebrado, que é pior que sprite parado.
 */
export function deslocamentoDoHeroi(movimento: MovimentoDoHeroi): { dx: number; dy: number } {
  const { pose, progresso, faseDoPasso, olhandoX } = movimento

  const restante = Number.isFinite(progresso) ? Math.min(1, Math.max(0, progresso)) : 0
  // A onda nasce e morre em zero ao longo da pose, e por isso entrar e sair
  // dela não produz salto — o pico fica no meio, onde o golpe acerta.
  const arcoDaPose = Math.sin(Math.PI * (1 - restante))

  // Valor absoluto do seno: o corpo sobe uma vez por passo e volta ao chão,
  // nunca afunda. Como o seno é periódico, qualquer fase serve de entrada e o
  // fim do ciclo emenda no começo sem descontinuidade.
  const balanco = Number.isFinite(faseDoPasso)
    ? Math.abs(Math.sin(Math.PI * faseDoPasso)) * AMPLITUDE_DO_BOB
    : 0

  const pulo = pose === 'comemorando' ? arcoDaPose * ALTURA_DO_PULO : 0
  // O avanço é assinado por `olhandoX`, e NÃO pelo espelhamento do sprite: o
  // espelho é interno a `desenharSprite` e acontece depois deste offset.
  const avanco = pose === 'atacando' ? arcoDaPose * AVANCO_DO_ATAQUE * (olhandoX < 0 ? -1 : 1) : 0

  return { dx: paraPixelDeMundo(avanco), dy: paraPixelDeMundo(-(balanco + pulo)) }
}

/**
 * Arredonda para pixel de mundo inteiro.
 *
 * O `+ 0` não é enfeite: `Math.round` devolve `-0` para qualquer negativo
 * pequeno, e `-0` faz "herói parado devolve exatamente zero" falhar num teste
 * de igualdade estrita sem nada estar errado no desenho.
 */
function paraPixelDeMundo(valor: number): number {
  return Number.isFinite(valor) ? Math.round(valor) + 0 : 0
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
 *
 * O deslocamento procedural entra nos DOIS ramos. O da silhueta geométrica não
 * é enfeite: é ele que aparece nos primeiros quadros depois de equipar uma
 * skin, enquanto o PNG novo ainda decodifica. Animar só o ramo do sprite faria
 * o boneco travar exatamente no instante em que o jogador está olhando para a
 * troca.
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
  faseDoPasso = 0,
  progressoDaPose = 0,
): void {
  const { dx, dy } = deslocamentoDoHeroi({
    pose,
    progresso: progressoDaPose,
    faseDoPasso,
    olhandoX,
  })

  const img = imagem(arteDoHeroi(pose, raridadeDaSkin))
  if (img) {
    // O sprite olha para a direita; espelhar é o que dá as duas direções sem
    // um segundo desenho.
    ctx.save()
    if (piscando) ctx.globalAlpha = 0.5
    // O offset vai ANTES do sprite e por FORA do espelhamento (que mora dentro
    // de `desenharSprite`): assim o avanço do ataque continua saindo do lado
    // para onde o herói olha, e não do lado para onde o desenho foi virado.
    ctx.translate(dx, dy)
    desenharSprite(ctx, img, x, y, ALTURA_HEROI, olhandoX < 0)
    ctx.restore()
    return
  }

  ctx.save()
  ctx.translate(x + dx, y + dy)
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

/**
 * Barra de vida do inimigo — só aparece depois do primeiro golpe.
 *
 * Barra em cima de todo mundo o tempo todo transforma a arena num painel de
 * controle. Aparecer no dano é o contrato do gênero: some sozinha quando o
 * inimigo é esquecido, e diz exatamente o que o jogador quer saber na hora em
 * que ele quer saber — "falta muito?".
 */
export function desenharBarraDoInimigo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  raio: number,
  proporcao: number,
  paleta: Paleta,
): void {
  const largura = Math.max(18, raio * 2)
  const topo = y - raio - 12

  ctx.fillStyle = paleta['--cor-contorno']
  ctx.fillRect(x - largura / 2 - 1, topo - 1, largura + 2, 5)
  ctx.fillStyle = paleta['--cor-bloqueado']
  ctx.fillRect(x - largura / 2, topo, largura * Math.min(1, Math.max(0, proporcao)), 3)
}

/**
 * O golpe de corpo — o arco que espada, martelo, adaga e punho desenham.
 *
 * É só desenho: o dano já foi aplicado no mesmo quadro em que o golpe nasceu
 * (`mundo.ts`). Separar as duas coisas evita a armadilha clássica de o dano
 * depender de a animação ter rodado — o que quebraria em aba de fundo.
 */
export function desenharGolpe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angulo: number,
  arco: number,
  alcance: number,
  progresso: number,
  paleta: Paleta,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angulo)
  ctx.globalAlpha = 0.15 + progresso * 0.55

  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.arc(0, 0, alcance, -arco / 2, arco / 2)
  ctx.closePath()
  ctx.fillStyle = paleta['--cor-texto']
  ctx.fill()

  // O fio do golpe: sem ele o arco lê como sombra, e não como corte.
  ctx.beginPath()
  ctx.arc(0, 0, alcance * 0.92, -arco / 2, arco / 2)
  ctx.strokeStyle = paleta['--cor-recompensa']
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.restore()
}

/**
 * Projétil — flecha do arco, orbe do cajado e da varinha.
 *
 * Duas formas distintas de propósito: o pedido era "o arco deve soltar flechas",
 * e flecha só é flecha se parecer flecha. O orbe fica redondo e com rastro, que
 * é a leitura de magia no gênero.
 */
export function desenharProjetil(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  tipo: 'flecha' | 'magia',
  paleta: Paleta,
): void {
  const angulo = Math.atan2(dy, dx)

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angulo)

  if (tipo === 'flecha') {
    ctx.strokeStyle = paleta['--cor-texto']
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-9, 0)
    ctx.lineTo(6, 0)
    ctx.stroke()

    // Ponta.
    ctx.beginPath()
    ctx.moveTo(10, 0)
    ctx.lineTo(4, -3.5)
    ctx.lineTo(4, 3.5)
    ctx.closePath()
    ctx.fillStyle = paleta['--cor-recompensa']
    ctx.fill()

    // Empena.
    ctx.beginPath()
    ctx.moveTo(-9, 0)
    ctx.lineTo(-13, -3)
    ctx.lineTo(-11, 0)
    ctx.lineTo(-13, 3)
    ctx.closePath()
    ctx.fillStyle = paleta['--cor-primaria']
    ctx.fill()
  } else {
    ctx.globalAlpha = 0.35
    ctx.beginPath()
    ctx.ellipse(-7, 0, 10, 3.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = paleta['--cor-secundaria']
    ctx.fill()

    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.arc(0, 0, 5, 0, Math.PI * 2)
    ctx.fillStyle = paleta['--cor-secundaria']
    ctx.fill()

    ctx.beginPath()
    ctx.arc(-1, -1, 2, 0, Math.PI * 2)
    ctx.fillStyle = paleta['--cor-texto']
    ctx.fill()
  }

  ctx.restore()
}

/**
 * Chão do bioma, em coordenadas de MUNDO.
 *
 * Desde `specs/mundo-aberto-e-modo-manual.md` o mapa é maior que a tela, então
 * o cenário não pode ser desenhado "na viewport": ele é ladrilhado pelo mundo, e
 * a câmera passa por cima. Se ficasse preso à tela, andar não moveria o chão — e
 * o mundo pareceria uma esteira.
 *
 * O CHÃO É PROCEDURAL, e não o PNG do bioma. Não é economia: `sc-*.png` tem
 * 608×352 e é um CENÁRIO DE FUNDO, com horizonte e profundidade — desenhado
 * para a arena de tela fixa que existia antes do mundo aberto. Ladrilhar isso
 * num jogo visto de cima produz faixa de horizonte repetida e árvore cortada em
 * grade: vira papel de parede, não lugar.
 *
 * Os PNGs de prop continuam entrando: objeto visto de cima funciona.
 *
 * A AMBIENTAÇÃO (2026-08-13, `specs/mapas-instanciados-combate-e-hud.md`, 3): a
 * malha de bolinhas chapada virou arena — malha hexagonal fina, migalhas
 * luminosas, borda do mapa desenhada e vinheta. É a leitura do Slither.io, que
 * é o que o dono pediu, e continua 100% procedural: nenhum arquivo novo, nenhum
 * byte a mais no orçamento de portal.
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
  mapa: { largura: number; altura: number },
  tempo = 0,
): void {
  const fundo = paleta[`--bioma-${bioma}-fundo`] ?? paleta['--cor-fundo']
  const detalhe = paleta[`--bioma-${bioma}-detalhe`] ?? paleta['--cor-secundaria']

  ctx.fillStyle = fundo
  ctx.fillRect(origemX, origemY, largura, altura)

  desenharMalha(ctx, origemX, origemY, largura, altura, detalhe, intensidade)
  desenharMigalhas(ctx, origemX, origemY, largura, altura, paleta, bioma, tempo)

  const primeiroX = Math.floor(origemX / LADO_LADRILHO)
  const ultimoX = Math.floor((origemX + largura) / LADO_LADRILHO)
  const primeiroY = Math.floor(origemY / LADO_LADRILHO)
  const ultimoY = Math.floor((origemY + altura) / LADO_LADRILHO)

  for (let ty = primeiroY; ty <= ultimoY; ty++) {
    for (let tx = primeiroX; tx <= ultimoX; tx++) {
      desenharProps(ctx, tx, ty, bioma, intensidade)
    }
  }

  desenharBordaDoMapa(ctx, origemX, origemY, largura, altura, paleta, detalhe, mapa)
}

/**
 * A malha hexagonal do fundo.
 *
 * Hexágono, e não quadrado, porque grade quadrada num jogo com movimento livre
 * lê como papel milimetrado — o olho fixa nas linhas retas e o mundo parece
 * parado. O hexágono dá referência de movimento sem competir com os atores.
 *
 * Desenhada em duas famílias de linhas curtas (o "favo" clássico) em vez de
 * caminho fechado por célula: um caminho por hexágono seria centenas de
 * `beginPath` por quadro.
 */
function desenharMalha(
  ctx: CanvasRenderingContext2D,
  origemX: number,
  origemY: number,
  largura: number,
  altura: number,
  cor: string,
  intensidade: number,
): void {
  // 32, e não 26: com a viewport maior o mundo desenha 20% menor na tela, e a
  // malha antiga virava textura fina — o oposto do que ela existe para fazer.
  const lado = 32
  const alturaLinha = lado * 1.5
  const passoX = lado * Math.sqrt(3)

  ctx.save()
  ctx.strokeStyle = cor
  ctx.globalAlpha = 0.07 + intensidade * 0.06
  ctx.lineWidth = 1.5
  ctx.beginPath()

  const inicioY = Math.floor(origemY / alturaLinha) * alturaLinha - alturaLinha
  const inicioX = Math.floor(origemX / passoX) * passoX - passoX

  for (let y = inicioY; y < origemY + altura + alturaLinha; y += alturaLinha) {
    const desloca = (Math.round(y / alturaLinha) % 2) * (passoX / 2)
    for (let x = inicioX + desloca; x < origemX + largura + passoX; x += passoX) {
      // Meio favo: o topo em "V" invertido mais a perna vertical. Repetido em
      // linhas alternadas, fecha o hexágono com metade dos traços.
      ctx.moveTo(x - passoX / 2, y - lado * 0.25)
      ctx.lineTo(x, y - lado * 0.75)
      ctx.lineTo(x + passoX / 2, y - lado * 0.25)
      ctx.lineTo(x + passoX / 2, y + lado * 0.25)
    }
  }

  ctx.stroke()
  ctx.restore()
}

/**
 * As migalhas — pontos luminosos espalhados pelo chão.
 *
 * São o que dá ESCALA ao movimento: sem um detalhe pequeno e frequente, andar
 * num fundo texturizado não parece andar. Posição derivada da célula, nunca
 * sorteada, então a mesma parte do mapa tem sempre as mesmas migalhas.
 *
 * O pulso é lento de propósito. Piscar rápido no fundo de um jogo que se joga
 * por horas é cansaço visual, não vida.
 */
function desenharMigalhas(
  ctx: CanvasRenderingContext2D,
  origemX: number,
  origemY: number,
  largura: number,
  altura: number,
  paleta: Paleta,
  bioma: number,
  tempo: number,
): void {
  // Mesmo motivo da malha: o passo acompanha a viewport para a migalha
  // continuar sendo referência de movimento, e não poeira.
  const passo = 105
  const cores = [
    paleta[`--bioma-${bioma}-assinatura`] ?? paleta['--cor-secundaria'],
    paleta['--cor-recompensa'],
    paleta['--cor-texto'],
  ]

  const inicioX = Math.floor(origemX / passo) * passo
  const inicioY = Math.floor(origemY / passo) * passo

  ctx.save()
  for (let y = inicioY; y < origemY + altura + passo; y += passo) {
    for (let x = inicioX; x < origemX + largura + passo; x += passo) {
      const celula = ruido(x / passo, y / passo)
      // Nem toda célula tem migalha: densidade uniforme vira grade, e grade
      // denuncia que o mundo é gerado.
      if (celula > 0.62) continue

      const cx = x + ruido(x / passo + 11, y / passo) * passo
      const cy = y + ruido(x / passo, y / passo + 7) * passo
      const cor = cores[Math.floor(celula * cores.length * 1.6) % cores.length]!
      const pulso = 0.55 + 0.45 * Math.sin(tempo * 1.4 + celula * 10)

      ctx.globalAlpha = 0.18 + celula * 0.25
      ctx.fillStyle = cor
      ctx.beginPath()
      ctx.arc(cx, cy, 2.5 + celula * 4.4 * pulso, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

/**
 * A borda do mapa.
 *
 * A arena precisa TER fim visível. Sem isto, chegar na borda é o herói parar de
 * andar sem motivo aparente — que o jogador lê como travamento, não como
 * limite. É o mesmo recurso do anel do Slither.io, e resolve em uma linha o que
 * uma mensagem de erro resolveria mal.
 *
 * Só o trecho de borda que toca a área visível é desenhado.
 */
function desenharBordaDoMapa(
  ctx: CanvasRenderingContext2D,
  origemX: number,
  origemY: number,
  largura: number,
  altura: number,
  paleta: Paleta,
  cor: string,
  mapa: { largura: number; altura: number },
): void {
  const visivel =
    origemX < 60 ||
    origemY < 60 ||
    origemX + largura > mapa.largura - 60 ||
    origemY + altura > mapa.altura - 60
  if (!visivel) return

  ctx.save()

  // Faixa de aviso por dentro, e a linha dura por cima.
  ctx.globalAlpha = 0.12
  ctx.strokeStyle = cor
  ctx.lineWidth = 44
  ctx.strokeRect(22, 22, mapa.largura - 44, mapa.altura - 44)

  ctx.globalAlpha = 0.9
  ctx.strokeStyle = paleta['--cor-bloqueado']
  ctx.lineWidth = 5
  ctx.strokeRect(0, 0, mapa.largura, mapa.altura)

  ctx.restore()
}

/** Ruído determinístico de 0 a 1. Mesma célula, mesmo valor, sempre. */
function ruido(a: number, b: number): number {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return n - Math.floor(n)
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
