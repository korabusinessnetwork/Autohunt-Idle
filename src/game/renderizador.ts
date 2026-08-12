// Renderização — atrás de uma interface, de propósito.
//
// A decisão D3 do spec de build trocou PixiJS por Canvas 2D nativo: o MVP
// desenha meia dúzia de sprites chapados, sem shader nem batching, e PixiJS
// custaria bundle e uma dependência nova para nada. Esta interface é o seguro:
// se o conteúdo crescer, entra um `RenderizadorPixi` implementando o mesmo
// contrato e nem `motor.ts` nem `mundo.ts` mudam.

import { precarregarBioma } from './atlas'
import { intensidadeDoBloco } from './biomas'
import { ALTURA_MUNDO, LARGURA_MUNDO, biomaAtual, poseDoHeroi, type EstadoMundo } from './mundo'
import { lerPaleta, type Paleta } from './paleta'
import { desenharCenario, desenharHeroi, desenharInimigo, desenharProjetil } from './sprites'

export interface Renderizador {
  desenhar(estado: EstadoMundo): void
  redimensionar(): void
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

  function redimensionar(): void {
    const largura = canvas.clientWidth
    const altura = canvas.clientHeight
    // O elemento pode ainda não ter sido posicionado (primeiro quadro, aba em
    // background). Escala zero geraria NaN no transform.
    if (largura <= 0 || altura <= 0) return

    const escala = Math.min(largura / LARGURA_MUNDO, altura / ALTURA_MUNDO)
    const dpr = window.devicePixelRatio || 1

    canvas.width = Math.round(largura * dpr)
    canvas.height = Math.round(altura * dpr)

    // Centraliza o mundo 16:9 dentro do espaço disponível. Sem este
    // deslocamento, o jogo fica colado no canto superior esquerdo em qualquer
    // container que não seja exatamente 16:9 — que é a regra dentro de um
    // iframe de portal, não a exceção.
    const deslocX = (largura - LARGURA_MUNDO * escala) / 2
    const deslocY = (altura - ALTURA_MUNDO * escala) / 2

    ctx!.setTransform(escala * dpr, 0, 0, escala * dpr, deslocX * dpr, deslocY * dpr)
    paleta = lerPaleta(document.documentElement)
  }

  redimensionar()

  return {
    desenhar(estado) {
      // O bioma sai do nível, e o nível veio do servidor pelo snapshot: nada
      // aqui é calculado para valer, só para desenhar.
      const zona = biomaAtual(estado)
      const bioma = zona.token
      const intensidade = intensidadeDoBloco(estado.nivel)

      // Aquece a arte da zona na primeira vez que ela aparece. Sem isto, subir
      // de bioma mostraria o cenário novo em silhueta justamente no quadro em
      // que o jogador está olhando para a mudança.
      if (bioma !== biomaAquecido) {
        biomaAquecido = bioma
        precarregarBioma(bioma, zona.assinatura.forma)
      }
      const corAssinatura = paleta[`--bioma-${bioma}-assinatura`] ?? paleta['--cor-primaria']

      // Pinta a moldura (o que sobra do 16:9) antes de entrar nas coordenadas
      // do mundo, para a área extra não ficar transparente. Usa o fundo do
      // bioma, senão a moldura denuncia a troca de zona com uma faixa creme.
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = paleta[`--bioma-${bioma}-fundo`] ?? paleta['--cor-fundo']
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.restore()

      desenharCenario(ctx, LARGURA_MUNDO, ALTURA_MUNDO, paleta, bioma, intensidade)

      for (const inimigo of estado.inimigos) {
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
      }

      for (const projetil of estado.projeteis) {
        desenharProjetil(ctx, projetil.x, projetil.y, paleta)
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

      // Pisca no reinício de ciclo — sinal visual de que o servidor reportou
      // Vitalidade zerada. Sem tela de morte, sem interrupção.
      const piscando = estado.reinicioCiclo > 0 && Math.floor(estado.reinicioCiclo * 10) % 2 === 0
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
    },
    redimensionar,
    destruir() {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    },
  }
}
