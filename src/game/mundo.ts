// Estado do mundo — simulação puramente VISUAL.
//
// Nada aqui vale economicamente. O herói anda, golpeia, leva dano e derruba
// inimigo na tela para o jogo ter cara de jogo (core, 15: "o client simula
// localmente pra sensação visual"), mas XP, moeda e nível vêm exclusivamente do
// servidor. Nenhum valor calculado neste arquivo é enviado para lugar nenhum.
//
// TRÊS PREMISSAS FORAM INVERTIDAS AQUI, nesta ordem:
//
//   · 2026-08-12 (`specs/mundo-aberto-e-modo-manual.md`) — o jogo virou MANUAL,
//     e o auto virou produto vendido. Até então este arquivo não conhecia input.
//
//   · 2026-08-13 (`specs/mapas-instanciados-combate-e-hud.md`) — o mapa único
//     de 8 regiões virou 8 MAPAS instanciados, escolhidos pelo jogador e
//     travados por nível.
//
//   · 2026-08-13, mesma spec — o combate passou a ter DUAS direções. O inimigo
//     dava zero de dano: encostava no herói e não acontecia nada. Agora ele
//     ataca, o herói tem vitalidade visual, e zerar essa barra devolve o herói
//     ao ponto de entrada sem tirar nada dele (core, 16 — não existe tela de
//     morte neste jogo).
//
// E o inimigo deixou de perseguir: ele vive num NINHO, vagueia em volta dele e
// só avança quando o herói entra na área. Quem procura é o jogador.
//
// O que NÃO mudou, e é o que importa: manual e auto creditam exatamente o
// mesmo. O servidor continua olhando só tempo × poder, então nenhum caminho
// deste arquivo pode influenciar recompensa — nem através do modo, nem através
// do mapa, nem através da arma.

import type { ChaveI18n } from '../lib/i18n'
import { ajusteVisual } from './ajustes'
import { PERFIL_PUNHO, type PerfilArma } from './armas'
import type { FormaAssinatura } from './biomas'
import type { PoseHeroi } from './atlas'
import { intencaoParada, type Intencao } from './entrada'
import {
  ALTURA_MAPA,
  LARGURA_MAPA,
  NINHOS_POR_MAPA,
  entradaDoMapa,
  escalaDoMapa,
  intensidadeDaPosicao,
  mapaPorId,
  poolDoMapa,
} from './mapas'

/**
 * O MÍNIMO de mundo que qualquer tela enxerga.
 *
 * Deixou de ser "a viewport" e virou um piso: o renderizador escolhe a escala
 * pelo menor lado e mostra MAIS mundo no que sobrar, em vez de pintar faixa
 * preta (`specs/mapas-instanciados-combate-e-hud.md`, 5). Numa tela ultrawide o
 * jogador vê mais dos lados; num celular em pé, mais em cima e embaixo.
 *
 * Subiu de 640×360 para 800×450 em 2026-08-13: o herói ocupava tela demais e a
 * arena sumia atrás dele. Mostrar 25% mais mundo em cada eixo encolhe TODO
 * mundo na mesma proporção — herói, inimigo e projétil juntos —, que é o
 * caminho certo para "o personagem está grande demais": diminuir só o sprite do
 * herói o faria menor que o bicho que ele caça.
 */
export const LARGURA_VIEWPORT = 800
export const ALTURA_VIEWPORT = 450

/** As 5 formas que aparecem em todos os mapas (critério 6: o pool base). */
export type FormaBase = 'casquinha' | 'minhoca' | 'rosquinha' | 'pirulito' | 'pudim'
/** Base mais o assinatura de cada bioma — 13 silhuetas no total, não 40. */
export type FormaInimigo = FormaBase | FormaAssinatura

export interface EspecieInimigo {
  forma: FormaInimigo
  nome: ChaveI18n
  raio: number
  vida: number
  velocidade: number
  /**
   * Multiplicador do dano por golpe, sobre o ajuste `inimigo_dano`.
   *
   * É multiplicador e não valor absoluto pelo mesmo motivo dos perfis de arma:
   * o dono regula a agressividade do jogo inteiro num controle só, e a espécie
   * continua sendo a diferença relativa entre uma criatura e outra.
   */
  dano: number
}

/**
 * Pool BASE — os 5 inimigos que aparecem em todo mapa, recoloridos pelo tema
 * da zona. Os nomes são chaves de tradução, nunca texto solto: nome de inimigo
 * nasce bilíngue como qualquer outro texto (core, 13/14).
 *
 * O dano segue a silhueta: o que é grande e lento bate forte, o que é pequeno e
 * rápido bate fraco. É o contrato de leitura do gênero — o jogador precisa
 * saber o que dói olhando, não morrendo.
 */
export const POOL_INIMIGOS: readonly EspecieInimigo[] = [
  { forma: 'casquinha', nome: 'inimigo.casquinha', raio: 13, vida: 30, velocidade: 26, dano: 1 },
  { forma: 'minhoca', nome: 'inimigo.minhoca', raio: 11, vida: 22, velocidade: 34, dano: 0.7 },
  { forma: 'rosquinha', nome: 'inimigo.rosquinha', raio: 18, vida: 60, velocidade: 16, dano: 1.7 },
  { forma: 'pirulito', nome: 'inimigo.pirulito', raio: 14, vida: 38, velocidade: 30, dano: 1.1 },
  { forma: 'pudim', nome: 'inimigo.pudim', raio: 16, vida: 48, velocidade: 12, dano: 1.5 },
]

/**
 * Onde um grupo de inimigos mora.
 *
 * O ninho é o que substitui o spawn ao redor do jogador. Sem ele, "o inimigo
 * não persegue" viraria "o inimigo fica parado exatamente onde nasceu, que é do
 * lado do herói" — ou seja, o mesmo problema com outro nome.
 */
export interface Ninho {
  id: number
  x: number
  y: number
  /** Segundos até repovoar. Dá tempo de o jogador limpar a área e seguir. */
  recarga: number
}

export interface Inimigo {
  id: number
  /** O ninho de origem. É para onde ele volta quando perde o herói de vista. */
  ninhoId: number
  especie: EspecieInimigo
  x: number
  y: number
  vida: number
  /** > 0 enquanto o sprite pisca por ter levado dano. */
  flash: number
  /** Segundos até o próximo golpe. */
  recargaAtaque: number
  /** Direção do passeio em volta do ninho, em radianos. */
  vagarAngulo: number
  /** Segundos até escolher outra direção de passeio. */
  vagarTempo: number
}

/**
 * Um inimigo que JÁ morreu e ainda está caindo.
 *
 * LISTA SEPARADA, e não um `Inimigo` com vida zero esperando a vez. É a
 * diferença entre um cadáver e um inimigo quase morto: mantido na lista de
 * inimigos, ele continuaria sendo mirado pela auto-mira, contando para a
 * população do ninho, empurrando o herói e podendo levar um segundo tiro. Aqui
 * ele só existe para o desenho, que é tudo o que sobrou dele.
 *
 * E por isso o abate continua imediato: o loot, o XP e a pose de comemoração
 * saem no MESMO quadro de sempre. A animação não atrasa recompensa nenhuma —
 * ela só mostra o que já aconteceu.
 */
export interface Morte {
  x: number
  y: number
  forma: FormaInimigo
  raio: number
  /** Segundos desde o abate. A folha de morte é lida a partir dele. */
  tempo: number
}

export interface Projetil {
  x: number
  y: number
  dx: number
  dy: number
  /**
   * Quanto de MUNDO o projétil ainda pode percorrer.
   *
   * Alcance medido em distância, e não em tempo de vida: é o que faz o número
   * da tabela de armas ser o alcance real na tela, e é o que garante que
   * "longo" nunca vira "infinito" (spec, 8).
   */
  distancia: number
  dano: number
  tipo: 'flecha' | 'magia'
}

/** Um golpe de corpo. Existe só para desenhar — o dano já foi aplicado. */
export interface Golpe {
  x: number
  y: number
  angulo: number
  arco: number
  alcance: number
  vida: number
}

/** Número de dano subindo na tela. É o que torna "está doendo" visível. */
export interface Aviso {
  x: number
  y: number
  valor: number
  vida: number
  alvo: 'heroi' | 'inimigo'
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
  /** Em qual das 8 instâncias o herói está. Nunca sai daqui. */
  mapaId: number
  heroiX: number
  heroiY: number
  heroiOlhandoX: number
  /**
   * Onde o herói está no ciclo de passo, em CICLOS (um passo inteiro = 1).
   *
   * O estado não sabia que o herói anda: não havia velocidade guardada, nem
   * posição anterior, nem relógio — e sem isso o desenho não tinha de onde
   * tirar um ciclo de caminhada.
   *
   * Avança com a DISTÂNCIA percorrida, não com o tempo: assim a cadência
   * acompanha `heroi_velocidade` sozinha, e andar contra a parede (onde o
   * `limitar` trava a posição) não produz passo no lugar.
   *
   * É dado de DESENHO. Nada aqui entra em cálculo nem sai para o servidor,
   * como todo o resto deste arquivo.
   */
  faseDoPasso: number
  /**
   * Vitalidade VISUAL do herói.
   *
   * O máximo é copiado do que o servidor publica (`vitalidadeMaxima`, que é
   * `100 + nível × 10 + Vitalidade × 25`), então a barra tem a escala do
   * servidor e o atributo Vitalidade se faz sentir na tela. Quem MOVE a barra,
   * porém, é esta simulação — e o que ela decide não volta para lá.
   */
  heroiVida: number
  heroiVidaMaxima: number
  /** Segundos de invulnerabilidade restantes. */
  invulneravel: number
  /** Segundos desde o último dano recebido. Governa a regeneração. */
  semDanoHa: number
  /** O que a arma equipada faz. Trocar de arma troca o combate, não o mundo. */
  arma: PerfilArma
  alvoId: number | null
  ninhos: Ninho[]
  inimigos: Inimigo[]
  /** Os abatidos que ainda estão caindo. Só desenho — ver `Morte`. */
  mortes: Morte[]
  projeteis: Projetil[]
  golpes: Golpe[]
  avisos: Aviso[]
  /** Segundos até o próximo ataque. */
  recargaTiro: number
  /**
   * Segundos restantes da pose de ataque e da de comemoração.
   *
   * São só temporizadores de DESENHO: a arte veio com três poses (parado,
   * atacando, comemorando) e sem isto o herói ficaria parado enquanto ataca,
   * que é o oposto de um jogo de ação. Nada aqui é enviado ao servidor nem
   * entra em cálculo — como todo o resto deste arquivo.
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
 * O ataque é curto de propósito: se passasse da recarga, o herói emendaria uma
 * pose de ataque na outra e nunca voltaria para "parado". A comemoração é maior
 * porque é a que dá o tom do jogo — pastelão, não heroico.
 */
const DURACAO_POSE_ATAQUE = 0.18
const DURACAO_POSE_COMEMORACAO = 0.5

/**
 * Quanto dura o lampejo de dano do inimigo, em segundos.
 *
 * Virou constante EXPORTADA porque quem desenha precisa do mesmo número: a
 * folha de dano tem dois quadros, e escolher entre eles exige saber onde a
 * contagem começou. Com o valor solto nos dois arquivos, mudar a duração aqui
 * deixaria o desenho preso no quadro errado sem erro nenhum de compilação.
 */
export const DURACAO_LAMPEJO = 0.12

/**
 * Quanto dura a queda de um abatido, em segundos.
 *
 * Curto de propósito. Abate é o que este jogo mais produz — dezenas por minuto
 * — e cadáver que demora vira lixo acumulado na tela em vez de peso do golpe.
 * A um terço de segundo o corpo achata, o jogador registra o abate e o campo
 * fica limpo antes do próximo.
 */
export const DURACAO_MORTE = 0.34

/**
 * Quantos pixels de MUNDO o herói percorre por passo.
 *
 * Com a velocidade padrão (110 px/s) dá pouco mais de quatro passos por
 * segundo: cadência de caminhada apressada, que é o que o boneco faz. Passo
 * mais curto vira trotezinho nervoso, mais longo vira arrasto.
 */
const COMPRIMENTO_DO_PASSO = 26

/**
 * Com que velocidade um passo interrompido termina o ciclo, em ciclos/segundo.
 *
 * Parar no meio da passada deixaria o herói permanentemente alguns pixels no
 * ar, numa altura diferente a cada vez. Ele termina o passo e assenta EXATO no
 * zero — que é o que faz "parado" ser sempre a mesma pose.
 */
const ASSENTAMENTO_DO_PASSO = 2.4

// Os números da SENSAÇÃO de jogar deixaram de ser constante e viraram ajuste
// editável pelo dono (`specs/console-de-ajuste.md`). Continuam sem valer nada
// economicamente — ver o cabeçalho de `ajustes.ts`.
//
// Desde a spec das armas, os três controles de ataque entram como BASE, e o
// perfil da arma multiplica: assim o dono continua regulando o jogo inteiro em
// três números, e a arma continua sendo a diferença relativa entre uma e outra.
const velocidadeHeroi = () => ajusteVisual('heroi_velocidade')
const velocidadeProjetil = () => ajusteVisual('projetil_velocidade')
const maxInimigos = () => ajusteVisual('inimigos_na_tela')
const danoDoInimigo = () => ajusteVisual('inimigo_dano')

const alcanceDoAtaque = (estado: EstadoMundo) =>
  ajusteVisual('heroi_alcance_tiro') * estado.arma.alcance
const recargaDoAtaque = (estado: EstadoMundo) =>
  ajusteVisual('heroi_recarga_tiro') * estado.arma.recarga
const danoDoAtaque = (estado: EstadoMundo) =>
  ajusteVisual('heroi_dano_projetil') * estado.arma.dano

/**
 * Raio ao redor do herói onde ninho e inimigo existem de verdade.
 *
 * Povoar o mapa inteiro seria simular centenas de criaturas que ninguém vê, a
 * 60fps. Como o raio é maior que a metade da tela, o inimigo já está lá quando
 * o jogador chega — ele não nasce no campo de visão.
 */
const RAIO_ATIVO = 760
/** Além disto o inimigo é esquecido; o ninho o refaz quando o herói voltar. */
const RAIO_DESCARTE = 1100
/** A partir daqui o inimigo avança no herói. Fora disso, ele nem olha. */
const RAIO_DE_AGRESSAO = 155
/** Até onde o inimigo passeia em volta do ninho. */
const RAIO_DO_NINHO = 84
/** Quantos inimigos um ninho tenta manter vivos. */
const POPULACAO_DO_NINHO = 3
/** Segundos entre limpar um ninho e ele repovoar. */
const RECARGA_DO_NINHO = 6
/** Segundos entre um golpe do inimigo e o próximo. */
const RECARGA_DE_ATAQUE_DO_INIMIGO = 1.1

/** Segundos de invulnerabilidade depois de levar dano. */
const INVULNERABILIDADE = 0.8
/** Segundos sem levar dano até a vitalidade voltar a subir. */
const ESPERA_PARA_REGENERAR = 4
/** Fração do máximo que regenera por segundo. */
const REGENERACAO_POR_SEGUNDO = 0.07
/** Quanto tempo um número de dano fica na tela. */
const DURACAO_DO_AVISO = 0.8
/** Teto de avisos simultâneos — a tela não é log. */
const MAXIMO_DE_AVISOS = 24

/** PRNG determinístico (mulberry32) — o mesmo mundo dá a mesma cena. */
function proximoAleatorio(estado: EstadoMundo): number {
  estado.semente = (estado.semente + 0x6d2b79f5) | 0
  let t = estado.semente
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Hash determinístico — mesma entrada, mesmo ninho, sempre. */
function hash(a: number, b: number): number {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return n - Math.floor(n)
}

/**
 * Os ninhos de um mapa.
 *
 * Derivados do id do mapa, nunca sorteados: o jogador que decorou onde tem
 * bicho precisa achar bicho lá de novo. Mapa que embaralha a cada visita não é
 * lugar, é gerador.
 *
 * Nenhum ninho nasce em cima da entrada — cair no mapa já cercado seria o
 * oposto de "o herói é quem procura".
 */
export function ninhosDoMapa(mapaId: number): Ninho[] {
  const entrada = entradaDoMapa()
  const ninhos: Ninho[] = []
  const margem = RAIO_DO_NINHO + 40

  for (let i = 0; i < NINHOS_POR_MAPA; i++) {
    const x = margem + hash(mapaId * 31 + i, i * 7 + 1) * (LARGURA_MAPA - margem * 2)
    const y = margem + hash(i * 17 + 3, mapaId * 53 + i) * (ALTURA_MAPA - margem * 2)
    // Longe da entrada: o jogador precisa de alguns passos antes do primeiro
    // encontro, senão a tela abre em briga.
    if (Math.hypot(x - entrada.x, y - entrada.y) < 260) continue
    ninhos.push({ id: i + 1, x, y, recarga: 0 })
  }
  return ninhos
}

export function criarMundo(semente = 1, mapaId = 1): EstadoMundo {
  const entrada = entradaDoMapa()
  const estado: EstadoMundo = {
    modo: 'manual',
    intencao: intencaoParada(),
    mapaId: mapaPorId(mapaId).id,
    heroiX: entrada.x,
    heroiY: entrada.y,
    heroiOlhandoX: 1,
    faseDoPasso: 0,
    heroiVida: 110,
    heroiVidaMaxima: 110,
    invulneravel: 0,
    semDanoHa: ESPERA_PARA_REGENERAR,
    arma: PERFIL_PUNHO,
    alvoId: null,
    ninhos: ninhosDoMapa(mapaId),
    inimigos: [],
    projeteis: [],
    mortes: [],
    golpes: [],
    avisos: [],
    recargaTiro: 0,
    poseAtaque: 0,
    poseComemoracao: 0,
    reinicioCiclo: 0,
    proximoId: 1,
    semente,
  }
  povoarNinhos(estado)
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
 * Troca de instância.
 *
 * Quem confere se o nível libera o mapa é a UI (`mapas.ts` tem a regra), não o
 * mundo — pela mesma razão de sempre: forçar o mapa 8 no nível 1 mostra o
 * cenário do endgame e credita exatamente o mesmo, então travar aqui seria
 * teatro de segurança.
 */
export function definirMapa(estado: EstadoMundo, mapaId: number): void {
  const alvo = mapaPorId(mapaId)
  if (alvo.id === estado.mapaId) return

  const entrada = entradaDoMapa()
  estado.mapaId = alvo.id
  estado.heroiX = entrada.x
  estado.heroiY = entrada.y
  // Chegar na instância nova é chegar parado: sem isto o herói apareceria na
  // entrada no meio de uma passada.
  estado.faseDoPasso = 0
  estado.ninhos = ninhosDoMapa(alvo.id)
  estado.inimigos = []
  // O cadáver também fica para trás. Ele guarda coordenada de mundo, e mundo
  // novo não herda o corpo do anterior — apareceria um abate fantasma na
  // instancia recém-aberta, no lugar onde ninguém morreu.
  estado.mortes = []
  estado.projeteis = []
  estado.golpes = []
  estado.avisos = []
  estado.heroiVida = estado.heroiVidaMaxima
  estado.invulneravel = INVULNERABILIDADE
  povoarNinhos(estado)
}

/** Qual arma está na mão. Vem do loadout que o servidor publica. */
export function definirArma(estado: EstadoMundo, arma: PerfilArma): void {
  estado.arma = arma
}

/**
 * Ajusta a escala da barra de vitalidade ao que o servidor publica.
 *
 * A proporção é preservada: subir de nível no meio de uma briga aumenta a
 * barra sem curar o herói de graça, e sem tirar vida dele.
 */
export function definirVitalidadeMaxima(estado: EstadoMundo, maxima: number): void {
  if (!Number.isFinite(maxima) || maxima <= 0) return
  const proporcao = estado.heroiVidaMaxima > 0 ? estado.heroiVida / estado.heroiVidaMaxima : 1
  estado.heroiVidaMaxima = maxima
  estado.heroiVida = Math.min(maxima, Math.max(1, Math.round(maxima * proporcao)))
}

/**
 * Teto de inimigos simulados por perto.
 *
 * Continua saindo de `inimigos_na_tela`, com a intensidade da posição somando
 * — é uma das alavancas que fazem um mapa não parecer chapado de ponta a ponta,
 * sem exigir arte nova.
 */
function quantosInimigos(estado: EstadoMundo): number {
  return (
    Math.round(maxInimigos()) +
    Math.round(intensidadeDaPosicao(estado.heroiX, estado.heroiY) * 4)
  )
}

/** Quantos inimigos daquele ninho estão vivos agora. */
function populacaoDoNinho(estado: EstadoMundo, ninhoId: number): number {
  let total = 0
  for (const inimigo of estado.inimigos) if (inimigo.ninhoId === ninhoId) total++
  return total
}

/**
 * Enche os ninhos que estão por perto e ainda cabem no teto.
 *
 * Ninho longe fica dormindo: repovoá-lo seria simular briga que ninguém vê.
 */
function povoarNinhos(estado: EstadoMundo): void {
  const teto = quantosInimigos(estado)

  for (const ninho of estado.ninhos) {
    if (estado.inimigos.length >= teto) return
    if (ninho.recarga > 0) continue
    if (Math.hypot(ninho.x - estado.heroiX, ninho.y - estado.heroiY) > RAIO_ATIVO) continue

    while (
      populacaoDoNinho(estado, ninho.id) < POPULACAO_DO_NINHO &&
      estado.inimigos.length < teto
    ) {
      surgirNoNinho(estado, ninho)
    }
  }
}

function surgirNoNinho(estado: EstadoMundo, ninho: Ninho): void {
  const mapa = mapaPorId(estado.mapaId)
  const intensidade = intensidadeDaPosicao(ninho.x, ninho.y)
  const escala = escalaDoMapa(mapa)

  // O pool do MAPA: os 5 base MAIS o assinatura do bioma — soma, não troca.
  const pool = poolDoMapa(POOL_INIMIGOS, mapa)
  const base = pool[Math.floor(proximoAleatorio(estado) * pool.length)]
  if (!base) return

  // Os multiplicadores de espécie do console entram aqui, uma vez, no
  // nascimento: inimigo que já está na tela não muda de tamanho no meio da
  // corrida quando o dono mexe no valor.
  const especie: EspecieInimigo = {
    ...base,
    raio: Math.max(
      2,
      Math.round(base.raio * (1 + intensidade * 0.35) * ajusteVisual('inimigo_tamanho')),
    ),
    vida: Math.max(1, base.vida * escala * ajusteVisual('inimigo_vida')),
    velocidade: base.velocidade * ajusteVisual('inimigo_velocidade'),
    dano: base.dano * escala,
  }

  const angulo = proximoAleatorio(estado) * Math.PI * 2
  const distancia = proximoAleatorio(estado) * RAIO_DO_NINHO

  estado.inimigos.push({
    id: estado.proximoId++,
    ninhoId: ninho.id,
    especie,
    x: limitar(ninho.x + Math.cos(angulo) * distancia, especie.raio, LARGURA_MAPA - especie.raio),
    y: limitar(ninho.y + Math.sin(angulo) * distancia, especie.raio, ALTURA_MAPA - especie.raio),
    vida: especie.vida,
    flash: 0,
    recargaAtaque: proximoAleatorio(estado) * RECARGA_DE_ATAQUE_DO_INIMIGO,
    vagarAngulo: proximoAleatorio(estado) * Math.PI * 2,
    vagarTempo: 1 + proximoAleatorio(estado) * 2,
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
  if (estado.invulneravel > 0) estado.invulneravel = Math.max(0, estado.invulneravel - dt)

  const alvo = inimigoMaisProximo(estado)
  estado.alvoId = alvo?.id ?? null

  estado.recargaTiro -= dt

  // Fotografia da fase ANTES do bloco de modo, e não da posição entre quadros:
  // `ferirHeroi` devolve o herói à entrada ao zerar a vitalidade e
  // `definirMapa` faz o mesmo ao trocar de instância, então delta de posição
  // entre quadros dispararia um ciclo de caminhada gigante na hora da morte.
  // Comparar dentro do mesmo quadro, antes de qualquer teleporte, é imune.
  const faseAntes = estado.faseDoPasso

  if (estado.modo === 'auto') {
    // O comportamento que o jogo TINHA antes da inversão de premissa: caça o
    // alvo mais próximo, aproxima até ficar em alcance e ataca. Com o inimigo
    // parado no ninho, o auto virou o que de fato é — um piloto automático que
    // vai atrás do bicho, e não um ímã de bicho.
    if (alvo) {
      const dx = alvo.x - estado.heroiX
      const dy = alvo.y - estado.heroiY
      const distancia = Math.hypot(dx, dy) || 1
      if (dx !== 0) estado.heroiOlhandoX = Math.sign(dx)

      const alcance = alcanceDoAtaque(estado) + alvo.especie.raio
      if (distancia > alcance * 0.7) mover(estado, dx / distancia, dy / distancia, dt)
      if (distancia <= alcance) atacar(estado, dx / distancia, dy / distancia)
    }
  } else {
    // Manual: o jogador anda para onde quer, e ataca para onde mira.
    const { dx, dy, miraX, miraY, atirando } = estado.intencao

    if (dx !== 0 || dy !== 0) {
      mover(estado, dx, dy, dt)
      if (dx !== 0) estado.heroiOlhandoX = Math.sign(dx)
    }

    if (atirando) {
      // Mira explícita (mouse) tem precedência; no toque e no teclado puro, a
      // mira é o alvo mais próximo — a spec do modo manual fecha isso em 4.2.
      let apontaX = miraX === null ? alvo && alvo.x - estado.heroiX : miraX - estado.heroiX
      let apontaY = miraY === null ? alvo && alvo.y - estado.heroiY : miraY - estado.heroiY

      if (typeof apontaX === 'number' && typeof apontaY === 'number') {
        const norma = Math.hypot(apontaX, apontaY) || 1
        apontaX /= norma
        apontaY /= norma
        if (miraX !== null) estado.heroiOlhandoX = Math.sign(apontaX) || estado.heroiOlhandoX
        atacar(estado, apontaX, apontaY)
      }
    }
  }

  // Ninguém andou neste quadro — nem o jogador, nem o piloto automático, nem o
  // herói empurrando a parede. O passo pendente termina e para no zero.
  if (estado.faseDoPasso === faseAntes) assentarPasso(estado, dt)

  avancarInimigos(estado, dt)
  avancarProjeteis(estado, dt)
  avancarEfeitos(estado, dt)
  regenerar(estado, dt)

  // Quem ficou para trás é esquecido: o jogador saiu daquela área, e o ninho
  // repovoa sozinho quando ele voltar.
  const abateu = estado.inimigos.some((i) => i.vida <= 0)

  // O cadáver nasce ANTES do filtro, e só para quem morreu de fato: quem sai
  // por distância não deixa corpo. Sumir por distância acontece fora da tela e
  // não é vitória de ninguém — marcar aquilo com uma animação de abate seria
  // creditar ao jogador um abate que ele não fez.
  for (const morto of estado.inimigos) {
    if (morto.vida > 0) continue
    estado.mortes.push({
      x: morto.x,
      y: morto.y,
      forma: morto.especie.forma,
      raio: morto.especie.raio,
      tempo: 0,
    })
  }

  estado.inimigos = estado.inimigos.filter(
    (i) => i.vida > 0 && Math.hypot(i.x - estado.heroiX, i.y - estado.heroiY) < RAIO_DESCARTE,
  )
  // Abateu alguém: comemora. É a pose que o jogador mais vê, porque abate é o
  // que o loop produz o tempo todo. Sumir por distância não é vitória.
  if (abateu) estado.poseComemoracao = DURACAO_POSE_COMEMORACAO

  for (const ninho of estado.ninhos) {
    if (ninho.recarga > 0) {
      ninho.recarga = Math.max(0, ninho.recarga - dt)
      continue
    }
    if (populacaoDoNinho(estado, ninho.id) === 0) ninho.recarga = RECARGA_DO_NINHO
  }
  povoarNinhos(estado)
}

/**
 * O inimigo NÃO persegue o herói pelo mapa.
 *
 * Ele passeia em volta do ninho; se o herói entra na área, avança e bate; se o
 * herói sai, volta para casa. É o critério 4 da spec — "no meio do mapa o
 * boneco encontra monstro, não o monstro vem atrás do boneco" — e é o que
 * impede o trem de criaturas que se formava quando todo inimigo do mapa mirava
 * o jogador para sempre.
 */
function avancarInimigos(estado: EstadoMundo, dt: number): void {
  for (const inimigo of estado.inimigos) {
    if (inimigo.flash > 0) inimigo.flash = Math.max(0, inimigo.flash - dt)
    if (inimigo.recargaAtaque > 0) inimigo.recargaAtaque = Math.max(0, inimigo.recargaAtaque - dt)

    const ninho = estado.ninhos.find((n) => n.id === inimigo.ninhoId)
    const dxHeroi = estado.heroiX - inimigo.x
    const dyHeroi = estado.heroiY - inimigo.y
    const distanciaHeroi = Math.hypot(dxHeroi, dyHeroi) || 1

    if (distanciaHeroi <= RAIO_DE_AGRESSAO) {
      const alcance = inimigo.especie.raio + 14
      if (distanciaHeroi > alcance) {
        inimigo.x += (dxHeroi / distanciaHeroi) * inimigo.especie.velocidade * dt
        inimigo.y += (dyHeroi / distanciaHeroi) * inimigo.especie.velocidade * dt
      } else if (inimigo.recargaAtaque <= 0) {
        inimigo.recargaAtaque = RECARGA_DE_ATAQUE_DO_INIMIGO
        ferirHeroi(estado, Math.max(1, Math.round(danoDoInimigo() * inimigo.especie.dano)))
      }
      continue
    }

    if (!ninho) continue

    const dxNinho = ninho.x - inimigo.x
    const dyNinho = ninho.y - inimigo.y
    const distanciaNinho = Math.hypot(dxNinho, dyNinho)

    if (distanciaNinho > RAIO_DO_NINHO) {
      // Volta para casa — em passo de caminhada, não de perseguição.
      inimigo.x += (dxNinho / distanciaNinho) * inimigo.especie.velocidade * 0.6 * dt
      inimigo.y += (dyNinho / distanciaNinho) * inimigo.especie.velocidade * 0.6 * dt
      continue
    }

    // Passeio: muda de direção de tempos em tempos. Sem isso o ninho vira um
    // amontoado parado, que lê como cenário e não como bicho.
    inimigo.vagarTempo -= dt
    if (inimigo.vagarTempo <= 0) {
      inimigo.vagarAngulo = proximoAleatorio(estado) * Math.PI * 2
      inimigo.vagarTempo = 1 + proximoAleatorio(estado) * 2
    }
    inimigo.x = limitar(
      inimigo.x + Math.cos(inimigo.vagarAngulo) * inimigo.especie.velocidade * 0.35 * dt,
      inimigo.especie.raio,
      LARGURA_MAPA - inimigo.especie.raio,
    )
    inimigo.y = limitar(
      inimigo.y + Math.sin(inimigo.vagarAngulo) * inimigo.especie.velocidade * 0.35 * dt,
      inimigo.especie.raio,
      ALTURA_MAPA - inimigo.especie.raio,
    )
  }
}

function avancarProjeteis(estado: EstadoMundo, dt: number): void {
  for (const projetil of estado.projeteis) {
    const passoX = projetil.dx * dt
    const passoY = projetil.dy * dt
    projetil.x += passoX
    projetil.y += passoY
    projetil.distancia -= Math.hypot(passoX, passoY)

    for (const inimigo of estado.inimigos) {
      if (projetil.distancia <= 0) break
      if (Math.hypot(inimigo.x - projetil.x, inimigo.y - projetil.y) <= inimigo.especie.raio) {
        ferirInimigo(estado, inimigo, projetil.dano)
        projetil.distancia = 0
      }
    }
  }

  estado.projeteis = estado.projeteis.filter(
    (p) =>
      p.distancia > 0 && p.x > -20 && p.x < LARGURA_MAPA + 20 && p.y > -20 && p.y < ALTURA_MAPA + 20,
  )
}

function avancarEfeitos(estado: EstadoMundo, dt: number): void {
  for (const morte of estado.mortes) morte.tempo += dt
  estado.mortes = estado.mortes.filter((m) => m.tempo < DURACAO_MORTE)

  for (const golpe of estado.golpes) golpe.vida -= dt
  estado.golpes = estado.golpes.filter((g) => g.vida > 0)

  for (const aviso of estado.avisos) {
    aviso.vida -= dt
    aviso.y -= 26 * dt
  }
  estado.avisos = estado.avisos.filter((a) => a.vida > 0)
}

/**
 * A vitalidade volta sozinha depois de um tempo sem apanhar.
 *
 * Sem regeneração, a única saída de uma barra baixa seria zerar — e zerar
 * teleporta o herói para a entrada, que é interrupção. Curar andando é o que
 * mantém o jogo em movimento (Princípio nº1).
 */
function regenerar(estado: EstadoMundo, dt: number): void {
  estado.semDanoHa += dt
  if (estado.semDanoHa < ESPERA_PARA_REGENERAR) return
  if (estado.heroiVida >= estado.heroiVidaMaxima) return

  estado.heroiVida = Math.min(
    estado.heroiVidaMaxima,
    estado.heroiVida + estado.heroiVidaMaxima * REGENERACAO_POR_SEGUNDO * dt,
  )
}

/**
 * Move o herói na direção dada, preso às bordas do MAPA (não da tela).
 *
 * É AQUI que o ciclo de passo avança, e não no bloco de modo: `mover` é o funil
 * por onde manual e auto passam. Enganchar na intenção do jogador teria
 * funcionado em todo teste manual e falhado calado no AUTO — que é o modo
 * vendido —, porque `definirModo` força intenção parada ao ligar o auto e
 * `definirIntencao` recusa input enquanto ele estiver ligado.
 */
function mover(estado: EstadoMundo, dirX: number, dirY: number, dt: number): void {
  const antesX = estado.heroiX
  const antesY = estado.heroiY

  estado.heroiX = limitar(estado.heroiX + dirX * velocidadeHeroi() * dt, 16, LARGURA_MAPA - 16)
  estado.heroiY = limitar(estado.heroiY + dirY * velocidadeHeroi() * dt, 16, ALTURA_MAPA - 16)

  // Medido DEPOIS do `limitar`: colado na parede, `mover` continua sendo
  // chamado todo quadro e a posição não muda. Sem esta conta o herói andaria no
  // lugar contra a borda do mapa.
  const andou = Math.hypot(estado.heroiX - antesX, estado.heroiY - antesY)
  if (andou > 0) estado.faseDoPasso = (estado.faseDoPasso + andou / COMPRIMENTO_DO_PASSO) % 1
}

/** Termina o passo interrompido e para exato no zero. */
function assentarPasso(estado: EstadoMundo, dt: number): void {
  if (estado.faseDoPasso === 0) return
  const restante = 1 - estado.faseDoPasso
  const avanco = ASSENTAMENTO_DO_PASSO * dt
  estado.faseDoPasso = avanco >= restante ? 0 : estado.faseDoPasso + avanco
}

/**
 * Ataca, se a recarga permitir.
 *
 * Aqui a arma decide o jogo: corpo resolve na hora, num arco à frente do herói;
 * à distância cria um projétil com alcance finito. Manual e auto passam pelo
 * mesmo caminho, como sempre.
 */
function atacar(estado: EstadoMundo, dirX: number, dirY: number): void {
  if (estado.recargaTiro > 0) return
  estado.recargaTiro = recargaDoAtaque(estado)
  estado.poseAtaque = DURACAO_POSE_ATAQUE

  if (estado.arma.corpo) golpear(estado, dirX, dirY)
  else disparar(estado, dirX, dirY)
}

/** Golpe de corpo — sem projétil nenhum, que é o pedido literal da spec. */
function golpear(estado: EstadoMundo, dirX: number, dirY: number): void {
  const alcance = alcanceDoAtaque(estado)
  const arco = estado.arma.arco
  const angulo = Math.atan2(dirY, dirX)
  const dano = danoDoAtaque(estado)

  estado.golpes.push({
    x: estado.heroiX,
    y: estado.heroiY,
    angulo,
    arco,
    alcance,
    vida: DURACAO_POSE_ATAQUE,
  })

  for (const inimigo of estado.inimigos) {
    const dx = inimigo.x - estado.heroiX
    const dy = inimigo.y - estado.heroiY
    if (Math.hypot(dx, dy) > alcance + inimigo.especie.raio) continue
    if (Math.abs(diferencaAngular(Math.atan2(dy, dx), angulo)) > arco / 2) continue
    ferirInimigo(estado, inimigo, dano)
  }
}

/** Menor diferença entre dois ângulos, em radianos, no intervalo [-π, π]. */
function diferencaAngular(a: number, b: number): number {
  let diferenca = (a - b) % (Math.PI * 2)
  if (diferenca > Math.PI) diferenca -= Math.PI * 2
  if (diferenca < -Math.PI) diferenca += Math.PI * 2
  return diferenca
}

/**
 * Projétil — flecha do arco, orbe do cajado e da varinha.
 *
 * A velocidade do orbe é menor que a da flecha: magia pesada tem que dar para
 * ver, senão a diferença entre arco e cajado só existe na tabela.
 */
function disparar(estado: EstadoMundo, dirX: number, dirY: number): void {
  const tipo = estado.arma.projetil ?? 'magia'
  const velocidade = velocidadeProjetil() * (tipo === 'flecha' ? 1.25 : 0.8)

  estado.projeteis.push({
    x: estado.heroiX,
    y: estado.heroiY,
    dx: dirX * velocidade,
    dy: dirY * velocidade,
    distancia: alcanceDoAtaque(estado),
    dano: danoDoAtaque(estado),
    tipo,
  })
}

function ferirInimigo(estado: EstadoMundo, inimigo: Inimigo, dano: number): void {
  inimigo.vida -= dano
  inimigo.flash = DURACAO_LAMPEJO
  anunciar(estado, inimigo.x, inimigo.y - inimigo.especie.raio, dano, 'inimigo')
}

/**
 * Dano no herói.
 *
 * O que acontece ao zerar é o núcleo da decisão: **nada é retirado**. O herói
 * pisca, reaparece na entrada do mapa com a barra cheia e continua farmando no
 * mesmo instante (core, 16). Não há tela de morte, não há cooldown, não há
 * perda — e nada disto é comunicado ao servidor, porque nada disto vale.
 */
function ferirHeroi(estado: EstadoMundo, dano: number): void {
  if (estado.invulneravel > 0) return

  estado.heroiVida -= dano
  estado.invulneravel = INVULNERABILIDADE
  estado.semDanoHa = 0
  anunciar(estado, estado.heroiX, estado.heroiY - 26, dano, 'heroi')

  if (estado.heroiVida > 0) return

  const entrada = entradaDoMapa()
  estado.heroiVida = estado.heroiVidaMaxima
  estado.heroiX = entrada.x
  estado.heroiY = entrada.y
  estado.invulneravel = 1.6
  estado.reinicioCiclo = 0.9
}

function anunciar(
  estado: EstadoMundo,
  x: number,
  y: number,
  valor: number,
  alvo: Aviso['alvo'],
): void {
  if (estado.avisos.length >= MAXIMO_DE_AVISOS) estado.avisos.shift()
  estado.avisos.push({ x, y, valor: Math.max(1, Math.round(valor)), vida: DURACAO_DO_AVISO, alvo })
}

/**
 * Canto superior esquerdo da câmera, em coordenadas de mundo.
 *
 * Recebe o tamanho da vista porque ele deixou de ser constante: o renderizador
 * mostra mais mundo em tela larga em vez de pintar faixa preta, então quem
 * conhece o tamanho é ele. Quando o mapa é menor que a vista (tela enorme), a
 * câmera centraliza o mapa em vez de encostar num canto.
 */
export function camera(
  estado: EstadoMundo,
  largura = LARGURA_VIEWPORT,
  altura = ALTURA_VIEWPORT,
): { x: number; y: number } {
  const limiteX = LARGURA_MAPA - largura
  const limiteY = ALTURA_MAPA - altura
  return {
    x: limiteX <= 0 ? limiteX / 2 : limitar(estado.heroiX - largura / 2, 0, limiteX),
    y: limiteY <= 0 ? limiteY / 2 : limitar(estado.heroiY - altura / 2, 0, limiteY),
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

/** O mapa onde o herói está — não mais função da posição, e nunca do nível. */
export function mapaAtual(estado: EstadoMundo) {
  return mapaPorId(estado.mapaId)
}

/** Bioma do mapa corrente. */
export function biomaAtual(estado: EstadoMundo) {
  return mapaAtual(estado).bioma
}

/** Intensidade visual da posição atual. */
export function intensidadeAtual(estado: EstadoMundo): number {
  return intensidadeDaPosicao(estado.heroiX, estado.heroiY)
}

/** Proporção da vitalidade visual, de 0 a 1 — o que a HUD desenha. */
export function proporcaoDeVida(estado: EstadoMundo): number {
  if (estado.heroiVidaMaxima <= 0) return 0
  return Math.min(1, Math.max(0, estado.heroiVida / estado.heroiVidaMaxima))
}

/**
 * Qual das três poses desenhar agora.
 *
 * O ataque tem prioridade sobre a comemoração porque é a ação em curso — e
 * porque a recarga deixa folga suficiente para a comemoração aparecer entre um
 * golpe e outro em vez de ser engolida por ela.
 */
export function poseDoHeroi(estado: EstadoMundo): PoseHeroi {
  if (estado.poseAtaque > 0) return 'atacando'
  if (estado.poseComemoracao > 0) return 'comemorando'
  return 'parado'
}

/**
 * Quanto RESTA da pose que `poseDoHeroi` acabou de escolher, de 1 a 0.
 *
 * Existe porque as durações são constantes de módulo e não saem daqui: sem esta
 * função, quem desenha teria que repetir 0.18 e 0.5 por conta própria, e
 * passaria a haver duas verdades sobre o mesmo tempo — a primeira a mudar
 * deixaria a outra para trás em silêncio.
 *
 * A precedência é a mesma de `poseDoHeroi`, de propósito: as duas respondem
 * sobre a MESMA pose, senão o desenho misturaria o tempo de uma com o gesto da
 * outra.
 */
export function progressoDaPose(estado: EstadoMundo): number {
  if (estado.poseAtaque > 0) return Math.min(1, estado.poseAtaque / DURACAO_POSE_ATAQUE)
  if (estado.poseComemoracao > 0) {
    return Math.min(1, estado.poseComemoracao / DURACAO_POSE_COMEMORACAO)
  }
  return 0
}
