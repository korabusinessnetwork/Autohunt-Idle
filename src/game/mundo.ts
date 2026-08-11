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

export const LARGURA_MUNDO = 640
export const ALTURA_MUNDO = 360

export type FormaInimigo = 'casquinha' | 'minhoca' | 'rosquinha' | 'pirulito' | 'pudim'

export interface EspecieInimigo {
  forma: FormaInimigo
  nome: ChaveI18n
  raio: number
  vida: number
  velocidade: number
}

/**
 * Pool de inimigos do bioma inicial. Os nomes são chaves de tradução, nunca
 * texto solto — inclusive os nomes de inimigo nascem bilíngues (core, 13/14).
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

export function criarMundo(semente = 1): EstadoMundo {
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
  }
  for (let i = 0; i < MAX_INIMIGOS; i++) surgirInimigo(estado)
  return estado
}

function surgirInimigo(estado: EstadoMundo): void {
  const especie = POOL_INIMIGOS[Math.floor(proximoAleatorio(estado) * POOL_INIMIGOS.length)]
  if (!especie) return

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
  const abatidos = estado.inimigos.length - sobreviventes.length
  estado.inimigos = sobreviventes
  for (let i = 0; i < abatidos; i++) surgirInimigo(estado)
  while (estado.inimigos.length < MAX_INIMIGOS) surgirInimigo(estado)
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
