// Estado do mundo aberto — simulação puramente VISUAL.
//
// Nada aqui vale economicamente. O herói anda, atira e derruba inimigo na tela
// para o jogo ter cara de jogo (core, 15: "o client simula localmente pra
// sensação visual"), mas XP, moeda e nível vêm exclusivamente do servidor.
// Nenhum valor calculado neste arquivo é enviado para lugar nenhum.
//
// O jogador não tem input: o herói escolhe alvo, se aproxima e ataca sozinho
// (core, 1). Não existe listener de teclado nem de clique no jogo.

import type { ChaveI18n } from '../lib/i18n'
import { biomaDoNivel, intensidadeDoBloco, poolDoBioma, type FormaAssinatura } from './biomas'

export const LARGURA_MUNDO = 640
export const ALTURA_MUNDO = 360

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

export interface EstadoMundo {
  heroiX: number
  heroiY: number
  heroiOlhandoX: number
  alvoId: number | null
  inimigos: Inimigo[]
  projeteis: Projetil[]
  /** Segundos até o próximo disparo. */
  recargaTiro: number
  /** > 0 enquanto a animação de "recomeçou o ciclo" está tocando. */
  reinicioCiclo: number
  proximoId: number
  semente: number
  /**
   * Nível do jogador, usado SÓ para escolher o cenário e o pool de inimigos.
   * Nada calculado a partir dele sai deste arquivo: bioma é cenário, e o
   * servidor continua sendo a única fonte de recompensa (core, 15).
   */
  nivel: number
}

const VELOCIDADE_HEROI = 70
const ALCANCE_TIRO = 150
const RECARGA_TIRO = 0.45
const VELOCIDADE_PROJETIL = 320
const DANO_PROJETIL = 12
const MAX_INIMIGOS = 6

/** PRNG determinístico (mulberry32) — o mesmo mundo dá a mesma cena. */
function proximoAleatorio(estado: EstadoMundo): number {
  estado.semente = (estado.semente + 0x6d2b79f5) | 0
  let t = estado.semente
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function criarMundo(semente = 1, nivel = 1): EstadoMundo {
  const estado: EstadoMundo = {
    heroiX: LARGURA_MUNDO / 2,
    heroiY: ALTURA_MUNDO / 2,
    heroiOlhandoX: 1,
    alvoId: null,
    inimigos: [],
    projeteis: [],
    recargaTiro: 0,
    reinicioCiclo: 0,
    proximoId: 1,
    semente,
    nivel,
  }
  for (let i = 0; i < quantosInimigos(estado); i++) surgirInimigo(estado)
  return estado
}

/**
 * Troca a zona sem recriar o mundo.
 *
 * Subir de nível no meio da sessão não pode piscar a cena inteira: os inimigos
 * vivos terminam a vida deles, e os próximos já nascem do pool novo. Recriar o
 * motor descartaria tudo num quadro, o que é pior que a transição gradual.
 */
export function definirNivel(estado: EstadoMundo, nivel: number): void {
  estado.nivel = nivel
}

/**
 * Densidade de inimigo cresce com o bloco — é uma das três alavancas que fazem
 * os 5 blocos de um bioma parecerem diferentes sem arte nova (critério 2).
 */
function quantosInimigos(estado: EstadoMundo): number {
  return MAX_INIMIGOS + Math.round(intensidadeDoBloco(estado.nivel) * 3)
}

function surgirInimigo(estado: EstadoMundo): void {
  // O pool da zona: os 5 base MAIS o assinatura do bioma — soma, não troca.
  const pool = poolDoBioma(POOL_INIMIGOS, estado.nivel)
  const base = pool[Math.floor(proximoAleatorio(estado) * pool.length)]
  if (!base) return

  // Inimigo cresce com o bloco, dentro do mesmo tema. Segunda alavanca da
  // escalada visual; a terceira é a saturação do cenário, no renderizador.
  const especie: EspecieInimigo = {
    ...base,
    raio: Math.round(base.raio * (1 + intensidadeDoBloco(estado.nivel) * 0.35)),
  }

  // Nasce longe do herói, para não aparecer em cima dele.
  const angulo = proximoAleatorio(estado) * Math.PI * 2
  const distancia = 140 + proximoAleatorio(estado) * 120

  estado.inimigos.push({
    id: estado.proximoId++,
    especie,
    x: limitar(estado.heroiX + Math.cos(angulo) * distancia, especie.raio, LARGURA_MUNDO - especie.raio),
    y: limitar(estado.heroiY + Math.sin(angulo) * distancia, especie.raio, ALTURA_MUNDO - especie.raio),
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

  const alvo = inimigoMaisProximo(estado)
  estado.alvoId = alvo?.id ?? null

  if (alvo) {
    const dx = alvo.x - estado.heroiX
    const dy = alvo.y - estado.heroiY
    const distancia = Math.hypot(dx, dy) || 1
    if (dx !== 0) estado.heroiOlhandoX = Math.sign(dx)

    // Aproxima até ficar em alcance de tiro, e então mantém a distância.
    if (distancia > ALCANCE_TIRO * 0.7) {
      estado.heroiX = limitar(estado.heroiX + (dx / distancia) * VELOCIDADE_HEROI * dt, 16, LARGURA_MUNDO - 16)
      estado.heroiY = limitar(estado.heroiY + (dy / distancia) * VELOCIDADE_HEROI * dt, 16, ALTURA_MUNDO - 16)
    }

    estado.recargaTiro -= dt
    if (estado.recargaTiro <= 0 && distancia <= ALCANCE_TIRO) {
      estado.recargaTiro = RECARGA_TIRO
      estado.projeteis.push({
        x: estado.heroiX,
        y: estado.heroiY,
        dx: (dx / distancia) * VELOCIDADE_PROJETIL,
        dy: (dy / distancia) * VELOCIDADE_PROJETIL,
        vida: 1.2,
      })
    }
  }

  for (const inimigo of estado.inimigos) {
    const dx = estado.heroiX - inimigo.x
    const dy = estado.heroiY - inimigo.y
    const distancia = Math.hypot(dx, dy) || 1
    inimigo.x += (dx / distancia) * inimigo.especie.velocidade * dt
    inimigo.y += (dy / distancia) * inimigo.especie.velocidade * dt
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
    (p) => p.vida > 0 && p.x > -20 && p.x < LARGURA_MUNDO + 20 && p.y > -20 && p.y < ALTURA_MUNDO + 20,
  )

  const sobreviventes = estado.inimigos.filter((i) => i.vida > 0)
  estado.inimigos = sobreviventes
  // Repõe até a densidade da zona atual. Ao subir de bloco a cena vai ficando
  // mais cheia sozinha, sem nenhum corte.
  while (estado.inimigos.length < quantosInimigos(estado)) surgirInimigo(estado)
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

/** Bioma que o cenário deve desenhar agora. */
export function biomaAtual(estado: EstadoMundo) {
  return biomaDoNivel(estado.nivel)
}
