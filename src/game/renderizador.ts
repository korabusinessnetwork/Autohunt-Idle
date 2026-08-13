// Renderização — atrás de uma interface, de propósito.
//
// A decisão D3 do spec de build trocou PixiJS por Canvas 2D nativo: o MVP
// desenha meia dúzia de sprites chapados, sem shader nem batching, e PixiJS
// custaria bundle e uma dependência nova para nada. Esta interface é o seguro:
// se o conteúdo crescer, entra um `RenderizadorPixi` implementando o mesmo
// contrato e nem `motor.ts` nem `mundo.ts` mudam.
//
// A VISTA DEIXOU DE SER FIXA (2026-08-13,
// `specs/mapas-instanciados-combate-e-hud.md`, 5). Até aqui o mundo era uma
// moldura 16:9 de 640×360 centralizada, com faixa pintada no que sobrava — ou
// seja, num monitor ultrawide o jogador ganhava barra, não jogo. Agora 640×360
// é um PISO: a escala nasce do menor lado, e o espaço que sobra vira mais
// mundo. É o que faz "cabe tudo em uma tela só" valer de 320px a 2560px.

import { precarregarBioma } from './atlas'
import { ALTURA_MAPA, LARGURA_MAPA } from './mapas'
import {
  ALTURA_VIEWPORT,
  LARGURA_VIEWPORT,
  biomaAtual,
  camera,
  intensidadeAtual,
  poseDoHeroi,
  type EstadoMundo,
} from './mundo'
import { lerPaleta, type Paleta } from './paleta'
import {
  desenharBarraDoInimigo,
  desenharCenario,
  desenharGolpe,
  desenharHeroi,
  desenharInimigo,
  desenharProjetil,
} from './sprites'

export interface Renderizador {
  desenhar(estado: EstadoMundo): void
  redimensionar(): void
  /**
   * Converte um ponto da tela em ponto do MUNDO.
   *
   * Existe porque o mouse mira em coordenada de tela e o mundo vive em outra —
   * e só o renderizador conhece a escala e a câmera. Deixar essa conta na
   * entrada duplicaria as duas.
   */
  paraCoordenadaDoMundo(clienteX: number, clienteY: number): { x: number; y: number }
  destruir(): void
}

/**
 * Tradutor dos nomes de inimigo. Passado de fora porque o motor não conhece
 * idioma — e porque nome de inimigo é texto de jogo, então nasce nas duas
 * línguas como qualquer outro (core, 13 e 14).
 */
export type NomeDeInimigo = (chave: EstadoMundo['inimigos'][number]['especie']['nome']) => string

/**
 * Raridade da skin equipada, ou `null` para nenhuma.
 *
 * É função, e não valor, pelo mesmo motivo do tradutor: o renderizador é criado
 * uma vez, e equipar uma skin não pode exigir remontar o canvas — o quadro
 * seguinte já desenha o sprite novo.
 */
export type RaridadeDaSkin = () => number | null

const MAPA = { largura: LARGURA_MAPA, altura: ALTURA_MAPA }

export function criarRenderizadorCanvas(
  canvas: HTMLCanvasElement,
  nomeDeInimigo: NomeDeInimigo,
  raridadeDaSkin: RaridadeDaSkin = () => null,
): Renderizador {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('CANVAS_2D_INDISPONIVEL')

  let paleta: Paleta = lerPaleta(document.documentElement)
  /** Última zona cujo pacote de arte foi pedido. Evita repedir todo quadro. */
  let biomaAquecido = 0

  /** Pixels de tela por unidade de mundo. */
  let escala = 1
  /** Quanto do MUNDO cabe na tela, em unidades de mundo. */
  let vistaLargura = LARGURA_VIEWPORT
  let vistaAltura = ALTURA_VIEWPORT

  function redimensionar(): void {
    const largura = canvas.clientWidth
    const altura = canvas.clientHeight
    // O elemento pode ainda não ter sido posicionado (primeiro quadro, aba em
    // background). Escala zero geraria NaN no transform.
    if (largura <= 0 || altura <= 0) return

    // O PISO garantido: nenhuma tela mostra menos que 640×360 de mundo. O lado
    // que sobra mostra mais mundo — nunca barra preta.
    escala = Math.min(largura / LARGURA_VIEWPORT, altura / ALTURA_VIEWPORT)
    const dpr = window.devicePixelRatio || 1

    canvas.width = Math.round(largura * dpr)
    canvas.height = Math.round(altura * dpr)

    vistaLargura = largura / escala
    vistaAltura = altura / escala

    ctx!.setTransform(escala * dpr, 0, 0, escala * dpr, 0, 0)
    paleta = lerPaleta(document.documentElement)
  }

  let ultimaCamera = { x: 0, y: 0 }

  redimensionar()

  return {
    desenhar(estado) {
      // O bioma sai do MAPA em que o herói está. Nada aqui é calculado para
      // valer, só para desenhar.
      const zona = biomaAtual(estado)
      const bioma = zona.token
      const intensidade = intensidadeAtual(estado)
      const vista = camera(estado, vistaLargura, vistaAltura)
      // Guardada para `paraCoordenadaDoMundo`: a mira do mouse precisa da mesma
      // câmera que acabou de ser desenhada, não da do quadro seguinte.
      ultimaCamera = vista
      const tempo = performance.now() / 1000

      // Aquece a arte da zona na primeira vez que ela aparece. Sem isto, trocar
      // de mapa mostraria o cenário novo em silhueta justamente no quadro em
      // que o jogador está olhando para a mudança.
      if (bioma !== biomaAquecido) {
        biomaAquecido = bioma
        precarregarBioma(bioma, zona.assinatura.forma)
      }
      const corAssinatura = paleta[`--bioma-${bioma}-assinatura`] ?? paleta['--cor-primaria']

      // Fora do mapa é preto de moldura, não transparente: quando a vista é
      // maior que o mapa (tela enorme), o que sobra precisa ter cor.
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = paleta['--cor-contorno']
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.restore()

      // A partir daqui tudo é desenhado em coordenadas de MUNDO, e a câmera é
      // só um deslocamento. Sem isto, cada sprite precisaria subtrair a câmera
      // por conta própria — e um deles esqueceria.
      ctx.save()
      ctx.translate(-vista.x, -vista.y)

      desenharCenario(
        ctx,
        vista.x,
        vista.y,
        vistaLargura,
        vistaAltura,
        paleta,
        bioma,
        intensidade,
        MAPA,
        tempo,
      )

      // O golpe de corpo vai por BAIXO dos atores: por cima, o arco esconderia
      // justamente o inimigo que ele está acertando.
      for (const golpe of estado.golpes) {
        desenharGolpe(
          ctx,
          golpe.x,
          golpe.y,
          golpe.angulo,
          golpe.arco,
          golpe.alcance,
          golpe.vida / 0.18,
          paleta,
        )
      }

      for (const inimigo of estado.inimigos) {
        // Fora da tela não se desenha. Com o mapa grande, a lista tem inimigos
        // que o jogador não vê.
        if (
          inimigo.x < vista.x - 40 ||
          inimigo.x > vista.x + vistaLargura + 40 ||
          inimigo.y < vista.y - 40 ||
          inimigo.y > vista.y + vistaAltura + 40
        ) {
          continue
        }
        desenharInimigo(
          ctx,
          inimigo.especie.forma,
          inimigo.x,
          inimigo.y,
          inimigo.especie.raio,
          inimigo.flash,
          paleta,
          corAssinatura,
        )
        if (inimigo.vida < inimigo.especie.vida) {
          desenharBarraDoInimigo(
            ctx,
            inimigo.x,
            inimigo.y,
            inimigo.especie.raio,
            inimigo.vida / inimigo.especie.vida,
            paleta,
          )
        }
      }

      for (const projetil of estado.projeteis) {
        desenharProjetil(ctx, projetil.x, projetil.y, projetil.dx, projetil.dy, projetil.tipo, paleta)
      }

      // Nome do alvo atual — é o que faz "Minhoca Azeda" / "Glum Worm"
      // realmente aparecer para o jogador, em vez de existir só no dicionário.
      const alvo = estado.inimigos.find((i) => i.id === estado.alvoId)
      if (alvo) {
        ctx.font = '700 11px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.lineWidth = 3
        ctx.strokeStyle = paleta['--cor-contorno']
        ctx.fillStyle = paleta['--cor-texto']
        const rotulo = nomeDeInimigo(alvo.especie.nome)
        const y = alvo.y + alvo.especie.raio + 15
        ctx.strokeText(rotulo, alvo.x, y)
        ctx.fillText(rotulo, alvo.x, y)
      }

      // Pisca no reinício de ciclo (aviso do servidor) e nos i-frames depois de
      // apanhar. Sem tela de morte, sem interrupção — nos dois casos.
      const piscando =
        (estado.reinicioCiclo > 0 && Math.floor(estado.reinicioCiclo * 10) % 2 === 0) ||
        (estado.invulneravel > 0 && Math.floor(estado.invulneravel * 12) % 2 === 0)
      desenharHeroi(
        ctx,
        estado.heroiX,
        estado.heroiY,
        estado.heroiOlhandoX,
        piscando,
        paleta,
        poseDoHeroi(estado),
        raridadeDaSkin(),
      )

      desenharAvisos(ctx, estado, paleta)

      ctx.restore()

      desenharVinheta(ctx, canvas, paleta)
    },
    redimensionar,

    paraCoordenadaDoMundo(clienteX, clienteY) {
      const caixa = canvas.getBoundingClientRect()
      if (!Number.isFinite(escala) || escala <= 0) return { x: 0, y: 0 }

      return {
        x: (clienteX - caixa.left) / escala + ultimaCamera.x,
        y: (clienteY - caixa.top) / escala + ultimaCamera.y,
      }
    },

    destruir() {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    },
  }
}

/**
 * Os números de dano.
 *
 * É o que torna "o monstro está me batendo" legível sem o jogador precisar
 * vigiar a barra — e era exatamente o defeito relatado: o dano existia (ou não)
 * sem nenhum sinal na tela. Vermelho quando dói no herói, creme quando dói no
 * inimigo: duas cores, zero legenda.
 */
function desenharAvisos(
  ctx: CanvasRenderingContext2D,
  estado: EstadoMundo,
  paleta: Paleta,
): void {
  if (estado.avisos.length === 0) return

  ctx.save()
  ctx.textAlign = 'center'
  ctx.lineWidth = 3
  ctx.strokeStyle = paleta['--cor-contorno']

  for (const aviso of estado.avisos) {
    const noHeroi = aviso.alvo === 'heroi'
    ctx.globalAlpha = Math.min(1, aviso.vida / 0.4)
    ctx.font = noHeroi ? '700 15px system-ui, sans-serif' : '700 12px system-ui, sans-serif'
    ctx.fillStyle = noHeroi ? paleta['--cor-bloqueado'] : paleta['--cor-texto']
    const texto = noHeroi ? `-${aviso.valor}` : String(aviso.valor)
    ctx.strokeText(texto, aviso.x, aviso.y)
    ctx.fillText(texto, aviso.x, aviso.y)
  }

  ctx.restore()
}

/**
 * Vinheta — escurece os cantos da TELA, não do mundo.
 *
 * Por isso é desenhada fora do `translate` da câmera: ela pertence ao olho, e
 * não ao lugar. É o que puxa a atenção para o centro, onde o herói está, e o
 * que dá à arena o acabamento do gênero.
 */
function desenharVinheta(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  paleta: Paleta,
): void {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  const meioX = canvas.width / 2
  const meioY = canvas.height / 2
  const raio = Math.hypot(meioX, meioY)
  const gradiente = ctx.createRadialGradient(meioX, meioY, raio * 0.55, meioX, meioY, raio)
  gradiente.addColorStop(0, 'transparent')
  gradiente.addColorStop(1, paleta['--cor-contorno'])

  ctx.globalAlpha = 0.55
  ctx.fillStyle = gradiente
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.restore()
}
