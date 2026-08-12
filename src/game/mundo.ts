// Estado do mundo aberto — simulação puramente VISUAL.
//
// Nada aqui vale economicamente. O herói anda, atira e derruba inimigo na tela
// para o jogo ter cara de jogo (core, 15: "o client simula localmente pra
// sensação visual"), mas XP, moeda e nível vêm exclusivamente do servidor.
// Nenhum valor calculado neste arquivo é enviado para lugar nenhum.
//
// PREMISSA INVERTIDA EM 2026-08-12 (`specs/mundo-aberto-e-modo-manual.md`): o
// jogo passou a ser MANUAL, e o auto virou produto vendido. Até então este
// arquivo não conhecia input nenhum.
//
// O que NÃO mudou, e é o que importa: manual e auto creditam exatamente o
// mesmo. O servidor continua olhando só tempo × poder, então nenhum caminho
// deste arquivo pode influenciar recompensa — nem através do modo.

import type { ChaveI18n } from '../lib/i18n'
import type { PoseHeroi } from './atlas'
import {
  ALTURA_MAPA,
  LARGURA_MAPA,
  biomaDaPosicao,
  intensidadeDaPosicao,
  poolDaPosicao,
  type FormaAssinatura,
} from './biomas'
import { intencaoParada, type Intencao } from './entrada'

/** A janela que o jogador enxerga. O MAPA é muito maior — ver `biomas.ts`. */
export const LARGURA_VIEWPORT = 640
export const ALTURA_VIEWPORT = 360

/** As 5 formas que aparecem em todos os biomas (critério 6: o pool base). */
export type FormaBase = 'casquinha' | 'minhoca' | 'rosquinha' | 'pirulito' | 'pudim'
/** Base mais o assinatura de cada bioma — 13 silhuetas no total, não 40. */
export type FormaInimigo = FormaBase | FormaAssinatura

export interface EspecieInimigo {
  forma: FormaInimigo
  nome: ChaveI18n
  raio: number
  vida: number
  velocidade: number
}

/**
 * Pool BASE — os 5 inimigos que aparecem em todo bioma, recoloridos pelo tema
 * da zona. Os nomes são chaves de tradução, nunca texto solto: nome de inimigo
 * nasce bilíngue como qualquer outro texto (core, 13/14).
 */
export const POOL_INIMIGOS: readonly EspecieInimigo[] = [
  { forma: 'casquinha', nome: 'inimigo.casquinha', raio: 13, vida: 30, velocidade: 26 },
  { forma: 'minhoca', nome: 'inimigo.minhoca', raio: 11, vida: 22, velocidade: 34 },
  { forma: 'rosquinha', nome: 'inimigo.rosquinha', raio: 18, vida: 60, velocidade: 16 },
  { forma: 'pirulito', nome: 'inimigo.pirulito', raio: 14, vida: 38, velocidade: 30 },
  { forma: 'pudim', nome: 'inimigo.pudim', raio: 16, vida: 48, velocidade: 12 },
]

export interface Inimigo {
  id: number
  especie: EspecieInimigo
  x: number
  y: number
  vida: number
  /** > 0 enquanto o sprite pisca por ter levado dano. */
  flash: number
}

export interface Projetil {
  x: number
  y: number
  dx: number
  dy: number
  vida: number
}

export type ModoDeJogo = 'manual' | 'auto'

export interface EstadoMundo {
  /**
   * Quem está no comando. `manual` é o padrão desde a inversão de premissa;
   * `auto` reproduz o comportamento que o jogo tinha antes dela.
   *
   * NÃO influencia recompensa nenhuma, e nunca é enviado ao servidor.
   */
  modo: ModoDeJogo
  /** Intenção do jogador neste quadro. Em `auto`, fica sempre parada. */
  intencao: Intencao
  heroiX: number
  heroiY: number
  heroiOlhandoX: number
  alvoId: number | null
  inimigos: Inimigo[]
  projeteis: Projetil[]
  /** Segundos até o próximo disparo. */
  recargaTiro: number
  /**
   * Segundos restantes da pose de ataque e da de comemoração.
   *
   * São só temporizadores de DESENHO: a arte veio com três poses (parado,
   * atacando, comemorando) e sem isto o herói ficaria parado enquanto atira,
   * que é o oposto de um jogo de auto-attack. Nada aqui é enviado ao servidor
   * nem entra em cálculo — como todo o resto deste arquivo.
   */
  poseAtaque: number
  poseComemoracao: number
  /** > 0 enquanto a animação de "recomeçou o ciclo" está tocando. */
  reinicioCiclo: number
  proximoId: number
  semente: number
}

/**
 * Quanto cada pose dura.
 *
 * O ataque é curto de propósito: se passasse da recarga (0,45s), o herói
 * emendaria uma pose de ataque na outra e nunca voltaria para "parado". A
 * comemoração é maior porque é a que dá o tom do jogo — pastelão, não heroico.
 */
const DURACAO_POSE_ATAQUE = 0.18
const DURACAO_POSE_COMEMORACAO = 0.5

const VELOCIDADE_HEROI = 110
const ALCANCE_TIRO = 210
const RECARGA_TIRO = 0.45
const VELOCIDADE_PROJETIL = 320
const DANO_PROJETIL = 12
const MAX_INIMIGOS = 8

/**
 * Raio ao redor do herói onde inimigos existem de verdade.
 *
 * O mapa tem 5120×1440 — povoá-lo inteiro seria simular centenas de criaturas
 * que ninguém vê, a 60fps. Só a vizinhança é simulada; o resto do mapa "existe"
 * porque a vizinhança acompanha o herói aonde ele for.
 */
const RAIO_ATIVO = 620
/** Além disto o inimigo é esquecido — o jogador já foi embora daquela área. */
const RAIO_DESCARTE = 900
/**
 * Nenhum inimigo nasce dentro deste raio (critério 8): aparecer no campo de
 * visão do jogador denuncia que o mundo é cenário, e não lugar.
 */
const RAIO_MINIMO_DE_SURGIMENTO = 420

/** PRNG determinístico (mulberry32) — o mesmo mundo dá a mesma cena. */
function proximoAleatorio(estado: EstadoMundo): number {
  estado.semente = (estado.semente + 0x6d2b79f5) | 0
  let t = estado.semente
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function criarMundo(semente = 1): EstadoMundo {
  const estado: EstadoMundo = {
    modo: 'manual',
    intencao: intencaoParada(),
    // Nasce no meio da primeira região — a Floresta de Algodão-Doce.
    heroiX: LARGURA_VIEWPORT,
    heroiY: ALTURA_VIEWPORT,
    heroiOlhandoX: 1,
    alvoId: null,
    inimigos: [],
    projeteis: [],
    recargaTiro: 0,
    poseAtaque: 0,
    poseComemoracao: 0,
    reinicioCiclo: 0,
    proximoId: 1,
    semente,
  }
  for (let i = 0; i < quantosInimigos(estado); i++) surgirInimigo(estado)
  return estado
}

/** Liga ou desliga o auto. Quem decide se pode é a UI, não o mundo. */
export function definirModo(estado: EstadoMundo, modo: ModoDeJogo): void {
  estado.modo = modo
  if (modo === 'auto') estado.intencao = intencaoParada()
}

/** Recebe a intenção do jogador. Ignorada enquanto o auto estiver ligado. */
export function definirIntencao(estado: EstadoMundo, intencao: Intencao): void {
  if (estado.modo === 'manual') estado.intencao = intencao
}

/**
 * Densidade de inimigo cresce com a intensidade da região — é uma das três
 * alavancas que fazem uma região não parecer chapada de ponta a ponta, sem
 * exigir arte nova (critério 2 da spec de origem).
 */
function quantosInimigos(estado: EstadoMundo): number {
  return MAX_INIMIGOS + Math.round(intensidadeDaPosicao(estado.heroiX, estado.heroiY) * 4)
}

function surgirInimigo(estado: EstadoMundo): void {
  const intensidade = intensidadeDaPosicao(estado.heroiX, estado.heroiY)

  // O pool da REGIÃO: os 5 base MAIS o assinatura do bioma — soma, não troca.
  const pool = poolDaPosicao(POOL_INIMIGOS, estado.heroiX, estado.heroiY)
  const base = pool[Math.floor(proximoAleatorio(estado) * pool.length)]
  if (!base) return

  const especie: EspecieInimigo = {
    ...base,
    raio: Math.round(base.raio * (1 + intensidade * 0.35)),
  }

  // Nasce FORA do campo de visão, dentro do raio ativo. É o que faz o mundo
  // parecer habitado em vez de gerado ao redor do jogador (critério 8).
  const angulo = proximoAleatorio(estado) * Math.PI * 2
  const distancia =
    RAIO_MINIMO_DE_SURGIMENTO + proximoAleatorio(estado) * (RAIO_ATIVO - RAIO_MINIMO_DE_SURGIMENTO)

  estado.inimigos.push({
    id: estado.proximoId++,
    especie,
    x: limitar(estado.heroiX + Math.cos(angulo) * distancia, especie.raio, LARGURA_MAPA - especie.raio),
    y: limitar(estado.heroiY + Math.sin(angulo) * distancia, especie.raio, ALTURA_MAPA - especie.raio),
    vida: especie.vida,
    flash: 0,
  })
}

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor))
}

function inimigoMaisProximo(estado: EstadoMundo): Inimigo | null {
  let melhor: Inimigo | null = null
  let menorDistancia = Infinity

  for (const inimigo of estado.inimigos) {
    const distancia = (inimigo.x - estado.heroiX) ** 2 + (inimigo.y - estado.heroiY) ** 2
    if (distancia < menorDistancia) {
      menorDistancia = distancia
      melhor = inimigo
    }
  }
  return melhor
}

/** Avança a cena em `dt` segundos. */
export function avancarMundo(estado: EstadoMundo, dt: number): void {
  if (estado.reinicioCiclo > 0) estado.reinicioCiclo = Math.max(0, estado.reinicioCiclo - dt)
  if (estado.poseAtaque > 0) estado.poseAtaque = Math.max(0, estado.poseAtaque - dt)
  if (estado.poseComemoracao > 0) estado.poseComemoracao = Math.max(0, estado.poseComemoracao - dt)

  const alvo = inimigoMaisProximo(estado)
  estado.alvoId = alvo?.id ?? null

  estado.recargaTiro -= dt

  if (estado.modo === 'auto') {
    // O comportamento que o jogo TINHA antes da inversão de premissa: caça o
    // alvo mais próximo, aproxima até ficar em alcance e atira.
    if (alvo) {
      const dx = alvo.x - estado.heroiX
      const dy = alvo.y - estado.heroiY
      const distancia = Math.hypot(dx, dy) || 1
      if (dx !== 0) estado.heroiOlhandoX = Math.sign(dx)

      if (distancia > ALCANCE_TIRO * 0.7) {
        mover(estado, dx / distancia, dy / distancia, dt)
      }
      if (distancia <= ALCANCE_TIRO) atirar(estado, dx / distancia, dy / distancia)
    }
  } else {
    // Manual: o jogador anda para onde quer, e atira para onde mira.
    const { dx, dy, miraX, miraY, atirando } = estado.intencao

    if (dx !== 0 || dy !== 0) {
      mover(estado, dx, dy, dt)
      if (dx !== 0) estado.heroiOlhandoX = Math.sign(dx)
    }

    if (atirando) {
      // Mira explícita (mouse) tem precedência; no toque e no teclado puro, a
      // mira é o alvo mais próximo — a spec fecha essa decisão em 4.2.
      let apontaX = miraX === null ? alvo && alvo.x - estado.heroiX : miraX - estado.heroiX
      let apontaY = miraY === null ? alvo && alvo.y - estado.heroiY : miraY - estado.heroiY

      if (typeof apontaX === 'number' && typeof apontaY === 'number') {
        const norma = Math.hypot(apontaX, apontaY) || 1
        apontaX /= norma
        apontaY /= norma
        if (miraX !== null) estado.heroiOlhandoX = Math.sign(apontaX) || estado.heroiOlhandoX
        atirar(estado, apontaX, apontaY)
      }
    }
  }

  for (const inimigo of estado.inimigos) {
    const dx = estado.heroiX - inimigo.x
    const dy = estado.heroiY - inimigo.y
    const distancia = Math.hypot(dx, dy) || 1
    // Longe demais, o inimigo fica parado: perseguir alguém a 800px de
    // distância é gastar quadro com o que ninguém vê.
    if (distancia < RAIO_ATIVO) {
      inimigo.x += (dx / distancia) * inimigo.especie.velocidade * dt
      inimigo.y += (dy / distancia) * inimigo.especie.velocidade * dt
    }
    if (inimigo.flash > 0) inimigo.flash = Math.max(0, inimigo.flash - dt)
  }

  for (const projetil of estado.projeteis) {
    projetil.x += projetil.dx * dt
    projetil.y += projetil.dy * dt
    projetil.vida -= dt

    for (const inimigo of estado.inimigos) {
      if (projetil.vida <= 0) break
      if (Math.hypot(inimigo.x - projetil.x, inimigo.y - projetil.y) <= inimigo.especie.raio) {
        inimigo.vida -= DANO_PROJETIL
        inimigo.flash = 0.12
        projetil.vida = 0
      }
    }
  }

  estado.projeteis = estado.projeteis.filter(
    (p) => p.vida > 0 && p.x > -20 && p.x < LARGURA_MAPA + 20 && p.y > -20 && p.y < ALTURA_MAPA + 20,
  )

  // Quem ficou para trás é esquecido: o jogador saiu daquela área, e o mundo
  // adiante repovoa sozinho.
  const sobreviventes = estado.inimigos.filter(
    (i) =>
      i.vida > 0 && Math.hypot(i.x - estado.heroiX, i.y - estado.heroiY) < RAIO_DESCARTE,
  )
  // Abateu alguém: comemora. É a pose que o jogador mais vê, porque abate é o
  // que o loop produz o tempo todo.
  // Só comemora se alguém foi ABATIDO — sumir por distância não é vitória.
  if (estado.inimigos.some((i) => i.vida <= 0)) {
    estado.poseComemoracao = DURACAO_POSE_COMEMORACAO
  }
  estado.inimigos = sobreviventes
  // Repõe até a densidade da região atual, sempre fora do campo de visão.
  while (estado.inimigos.length < quantosInimigos(estado)) surgirInimigo(estado)
}

/** Move o herói na direção dada, preso às bordas do MAPA (não da tela). */
function mover(estado: EstadoMundo, dirX: number, dirY: number, dt: number): void {
  estado.heroiX = limitar(estado.heroiX + dirX * VELOCIDADE_HEROI * dt, 16, LARGURA_MAPA - 16)
  estado.heroiY = limitar(estado.heroiY + dirY * VELOCIDADE_HEROI * dt, 16, ALTURA_MAPA - 16)
}

/** Dispara, se a recarga permitir. Manual e auto passam pelo mesmo caminho. */
function atirar(estado: EstadoMundo, dirX: number, dirY: number): void {
  if (estado.recargaTiro > 0) return
  estado.recargaTiro = RECARGA_TIRO
  estado.poseAtaque = DURACAO_POSE_ATAQUE
  estado.projeteis.push({
    x: estado.heroiX,
    y: estado.heroiY,
    dx: dirX * VELOCIDADE_PROJETIL,
    dy: dirY * VELOCIDADE_PROJETIL,
    vida: 1.2,
  })
}

/**
 * Canto superior esquerdo da câmera, em coordenadas de mundo.
 *
 * Segue o herói e para nas bordas do mapa — sem isso, chegar na borda mostraria
 * o vazio de fora do mundo.
 */
export function camera(estado: EstadoMundo): { x: number; y: number } {
  return {
    x: limitar(estado.heroiX - LARGURA_VIEWPORT / 2, 0, LARGURA_MAPA - LARGURA_VIEWPORT),
    y: limitar(estado.heroiY - ALTURA_VIEWPORT / 2, 0, ALTURA_MAPA - ALTURA_VIEWPORT),
  }
}

/**
 * Marca visualmente que o servidor reportou um ciclo perdido.
 *
 * Não há tela de morte, não há cooldown e nada é retirado do jogador: o herói
 * pisca e continua farmando no mesmo instante (core, 16).
 */
export function sinalizarReinicioDeCiclo(estado: EstadoMundo): void {
  estado.reinicioCiclo = 0.9
}

/** Bioma da REGIÃO onde o herói está — não mais função do nível. */
export function biomaAtual(estado: EstadoMundo) {
  return biomaDaPosicao(estado.heroiX, estado.heroiY)
}

/** Intensidade visual da posição atual. */
export function intensidadeAtual(estado: EstadoMundo): number {
  return intensidadeDaPosicao(estado.heroiX, estado.heroiY)
}

/**
 * Qual das três poses desenhar agora.
 *
 * O ataque tem prioridade sobre a comemoração porque é a ação em curso — e
 * porque a recarga (0,45s) deixa folga suficiente para a comemoração aparecer
 * entre um tiro e outro em vez de ser engolida por ela.
 */
export function poseDoHeroi(estado: EstadoMundo): PoseHeroi {
  if (estado.poseAtaque > 0) return 'atacando'
  if (estado.poseComemoracao > 0) return 'comemorando'
  return 'parado'
}
