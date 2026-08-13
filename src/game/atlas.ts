// Atlas de arte — o índice único do que existe em `public/arte/`.
//
// Fecha a dívida D3 do backlog: a arte foi encomendada ao Claude Design, voltou
// em 2026-08-12 (230 arquivos curados, ver `docs/02_DESIGN_SYSTEM/inventario-de-arte.md`)
// e este módulo é onde ela entra no jogo.
//
// DUAS REGRAS MOLDAM ESTE ARQUIVO:
//
// 1. **Nenhum caminho de arte é montado fora daqui.** Um `src` solto num
//    componente é um arquivo que ninguém percebe que sumiu até o jogador ver o
//    ícone quebrado. Aqui tudo é tabela, e um teste confere arquivo por arquivo
//    contra o disco — se um asset for renomeado, o build reprova.
//
// 2. **Arte nunca é pré-requisito para jogar.** O carregador é assíncrono e
//    devolve `null` enquanto a imagem não está pronta; quem desenha cai na
//    silhueta geométrica. É o Princípio nº1: o jogo abre e roda mesmo com a
//    rede lenta, com o CDN fora do ar, ou com um asset faltando.
//
// Este módulo é puro índice + cache. Não conhece regra de jogo, e nada aqui
// entra em cálculo de recompensa — arte é arte.

import type { SlotEquipamento, TipoDano, TipoItem } from '../lib/tipos'
import { embaralhar, familiaDaArma } from './armas'
import type { FormaAssinatura } from './biomas'
import type { FormaBase, FormaInimigo } from './mundo'

/** Pasta publicada. Relativa: os portais servem o jogo de um subdiretório. */
const RAIZ = 'arte'

/**
 * Converte um caminho do atlas em URL carregável.
 *
 * O `BASE_URL` entra só aqui, e não nas tabelas, porque os testes precisam
 * casar as tabelas com o disco (`public/arte/...`) sem saber de deploy.
 */
export function urlDaArte(relativo: string): string {
  const base = import.meta.env?.BASE_URL ?? '/'
  return `${base.endsWith('/') ? base : `${base}/`}${relativo}`
}

// ---------------------------------------------------------------------------
// Personagem
// ---------------------------------------------------------------------------

/** As 3 poses entregues. O motor escolhe pela ação, não pelo tempo. */
export type PoseHeroi = 'parado' | 'atacando' | 'comemorando'

export const ARTE_POSE: Record<PoseHeroi, string> = {
  parado: `${RAIZ}/personagem/pose-idle.png`,
  atacando: `${RAIZ}/personagem/pose-attack.png`,
  comemorando: `${RAIZ}/personagem/pose-celebrate.png`,
}

/**
 * As 8 skins, da mais comum à mais cobiçada.
 *
 * O banco não guarda QUAL skin é (`item_jogador` só tem tipo e raridade — ver
 * `supabase/migrations/20260815_dungeon_raridade_sintese.sql`), então a
 * raridade é o que escolhe o visual. É o que faz uma skin cósmica parecer
 * cósmica sem migration nova.
 */
export const ARTE_SKIN: readonly string[] = [
  'sk-base',
  'sk-guerreiro',
  'sk-pirata',
  'sk-shinobi',
  'sk-kitsune',
  'sk-arquimago',
  'sk-ceifador',
  'sk-cosmico',
].map((nome) => `${RAIZ}/skins/${nome}.png`)

/** Raridade 1–10 → uma das 8 skins, monotônico e sem buraco. */
export function arteDaSkin(raridade: number): string {
  const tier = Math.min(10, Math.max(1, Math.trunc(raridade) || 1))
  const indice = Math.min(ARTE_SKIN.length - 1, Math.floor(((tier - 1) * ARTE_SKIN.length) / 10))
  return ARTE_SKIN[indice]!
}

/**
 * Sprite do herói: a skin equipada, ou a pose quando não há skin.
 *
 * A pose só sobrevive sem skin porque as skins vieram numa pose única. Trocar
 * isso é acrescentar `sk-*-attack.png` ao pacote — o motor já pede a pose.
 */
export function arteDoHeroi(pose: PoseHeroi, raridadeDaSkin: number | null): string {
  return raridadeDaSkin === null ? ARTE_POSE[pose] : arteDaSkin(raridadeDaSkin)
}

// ---------------------------------------------------------------------------
// Inimigos
// ---------------------------------------------------------------------------

/** Os 5 do pool base, presentes em todo bioma. */
export const ARTE_INIMIGO: Record<FormaBase, string> = {
  casquinha: `${RAIZ}/inimigos/en-casquinha.png`,
  minhoca: `${RAIZ}/inimigos/en-minhoca.png`,
  rosquinha: `${RAIZ}/inimigos/en-rosquinha.png`,
  pirulito: `${RAIZ}/inimigos/en-pirulito.png`,
  pudim: `${RAIZ}/inimigos/en-pudim.png`,
}

/**
 * Silhueta creme de cada inimigo base — o quadro de dano.
 *
 * Veio no pacote e substitui o `globalAlpha` que o placeholder usava: em pixel
 * art, transparência lava a leitura, enquanto o lampejo sólido é a convenção do
 * gênero e some no mesmo quadro.
 */
export const ARTE_INIMIGO_DANO: Record<FormaBase, string> = {
  casquinha: `${RAIZ}/inimigos/en-casquinha-sil.png`,
  minhoca: `${RAIZ}/inimigos/en-minhoca-sil.png`,
  rosquinha: `${RAIZ}/inimigos/en-rosquinha-sil.png`,
  pirulito: `${RAIZ}/inimigos/en-pirulito-sil.png`,
  pudim: `${RAIZ}/inimigos/en-pudim-sil.png`,
}

/**
 * O apelido de cada bioma nos arquivos de arte, na ordem dos ids 1–8 de
 * `BIOMAS`. Não é chave de tradução: é nome de arquivo.
 */
export const APELIDO_BIOMA: readonly string[] = [
  'floresta',
  'geleia',
  'deserto',
  'recife',
  'chocolate',
  'geleira',
  'vulcao',
  'cosmico',
]

/** Inimigo assinatura — um por bioma, na ordem das formas de `biomas.ts`. */
export const ARTE_ASSINATURA: Record<FormaAssinatura, string> = {
  algodao: `${RAIZ}/biomas/en-floresta.png`,
  geleia: `${RAIZ}/biomas/en-geleia.png`,
  toffee: `${RAIZ}/biomas/en-deserto.png`,
  concha: `${RAIZ}/biomas/en-recife.png`,
  trufa: `${RAIZ}/biomas/en-chocolate.png`,
  floco: `${RAIZ}/biomas/en-geleira.png`,
  brasa: `${RAIZ}/biomas/en-vulcao.png`,
  confete: `${RAIZ}/biomas/en-cosmico.png`,
}

/**
 * Sprite de qualquer inimigo, base ou assinatura.
 *
 * As duas tabelas existem separadas porque vêm de levas diferentes do pacote,
 * mas quem desenha não deveria precisar saber disso — o motor conhece
 * `FormaInimigo`, que é a união das duas.
 */
export function arteDoInimigo(forma: FormaInimigo): string {
  return forma in ARTE_INIMIGO
    ? ARTE_INIMIGO[forma as FormaBase]
    : ARTE_ASSINATURA[forma as FormaAssinatura]
}

/** Silhueta de dano desenhada à mão, quando existe. Só os 5 do pool base têm. */
export function arteDoDanoDoInimigo(forma: FormaInimigo): string | null {
  return forma in ARTE_INIMIGO_DANO ? ARTE_INIMIGO_DANO[forma as FormaBase] : null
}

// ---------------------------------------------------------------------------
// Cenário
// ---------------------------------------------------------------------------

function apelidoDoBioma(bioma: number): string {
  const indice = Math.min(APELIDO_BIOMA.length, Math.max(1, Math.trunc(bioma) || 1)) - 1
  return APELIDO_BIOMA[indice]!
}

/** O fundo da zona — um tile 608×352, quase exatamente o mundo de 640×360. */
export function arteDoCenario(bioma: number): string {
  return `${RAIZ}/biomas/sc-${apelidoDoBioma(bioma)}.png`
}

/** O elemento de mundo espalhado sobre o cenário (árvore, duna, plataforma). */
export function arteDoProp(bioma: number): string {
  return `${RAIZ}/biomas/prop-${apelidoDoBioma(bioma)}.png`
}

// ---------------------------------------------------------------------------
// Itens
// ---------------------------------------------------------------------------

/**
 * As três famílias de acessório. As de ARMA não moram mais aqui: desde
 * `specs/mapas-instanciados-combate-e-hud.md` a família da arma decide também
 * o COMBATE, então ela mudou-se para `armas.ts` e este módulo passou a
 * consumi-la.
 *
 * A mudança é o que garante que o ícone nunca minta: um item que mostra arco
 * atira flecha porque as duas respostas saem da mesma função.
 */
const ACESSORIOS = ['anel', 'colar', 'brinco'] as const

/** Raridade 1–10 → sufixo 0–9 dos arquivos de item. */
function sufixoDeRaridade(raridade: number): number {
  return Math.min(10, Math.max(1, Math.trunc(raridade) || 1)) - 1
}

/**
 * Chaves de dungeon — 4 desenhos cobrindo os 10 tiers.
 *
 * A faixa é grosseira de propósito: chave é consumível, aparece em contador, e
 * quatro degraus já comunicam "esta vale mais" sem exigir 10 desenhos.
 */
const CHAVES: readonly { ate: number; nome: string }[] = [
  { ate: 2, nome: 'comum' },
  { ate: 5, nome: 'raro' },
  { ate: 8, nome: 'epico' },
  { ate: 10, nome: 'cosmico' },
]

/** Ícone de slot vazio, um por slot equipável. */
export const ARTE_SLOT_VAZIO: Record<SlotEquipamento, string> = {
  arma: `${RAIZ}/slots/eq-arma1.png`,
  capacete: `${RAIZ}/slots/eq-capacete.png`,
  armadura: `${RAIZ}/slots/eq-armadura.png`,
  luva: `${RAIZ}/slots/eq-luva.png`,
  bota: `${RAIZ}/slots/eq-bota.png`,
  acessorio: `${RAIZ}/slots/eq-anel.png`,
  skin: `${RAIZ}/personagem/pose-idle.png`,
}

export const ARTE_DIAMANTE = `${RAIZ}/slots/ic-diamante.png`

/**
 * Ícone de um item.
 *
 * Devolve `null` quando o pacote não cobre aquele tipo — e nesse caso quem
 * chama mostra o rótulo de texto, que é o que já existia. Os quatro slots de
 * armadura (capacete, armadura, luva, bota) e as três pedras caem aqui: o
 * pacote entregue não tem ícone por raridade para eles (dívida D16 do backlog),
 * então usam o ícone de slot, sem escalada visual de raridade.
 */
export function arteDoItem(
  tipo: TipoItem,
  raridade: number,
  id = '',
  tipoDano: TipoDano | null = null,
): string | null {
  const sufixo = sufixoDeRaridade(raridade)
  const semente = embaralhar(id)

  switch (tipo) {
    case 'arma':
      return `${RAIZ}/itens/w-${familiaDaArma(id, tipoDano)}-${sufixo}.png`
    case 'acessorio': {
      const familia = ACESSORIOS[semente % ACESSORIOS.length]!
      return `${RAIZ}/itens/ac-${familia}-${sufixo}.png`
    }
    case 'skin':
      return arteDaSkin(raridade)
    case 'chave': {
      const faixa = CHAVES.find((c) => sufixo + 1 <= c.ate) ?? CHAVES[CHAVES.length - 1]!
      return `${RAIZ}/dungeon/key-${faixa.nome}.png`
    }
    case 'capacete':
    case 'armadura':
    case 'luva':
    case 'bota':
      return ARTE_SLOT_VAZIO[tipo]
    default:
      // As três pedras. Sem arte no pacote — quem chama mostra o rótulo.
      return null
  }
}

// ---------------------------------------------------------------------------
// Carregador
// ---------------------------------------------------------------------------

/**
 * Cache de imagens já decodificadas.
 *
 * Módulo-level porque a arte é imutável e compartilhada: remontar o canvas
 * (trocar de aba, redimensionar) não pode rebaixar o jogo para as silhuetas de
 * novo.
 */
const cache = new Map<string, HTMLImageElement>()
/** Caminhos que falharam. Existe para não repetir requisição que já deu 404. */
const falhas = new Set<string>()

/**
 * A imagem, se já estiver pronta para desenhar.
 *
 * `null` significa "ainda não" ou "nunca vai" — e as duas respostas levam ao
 * mesmo lugar: quem desenha usa a silhueta. Chamar isto é o que dispara o
 * carregamento, então não existe passo de inicialização a esquecer.
 */
export function imagem(relativo: string): HTMLImageElement | null {
  if (falhas.has(relativo)) return null

  const guardada = cache.get(relativo)
  if (guardada) return guardada.complete && guardada.naturalWidth > 0 ? guardada : null

  // Ambiente sem DOM (teste de nó, SSR): nunca há imagem, e isso é correto.
  if (typeof Image === 'undefined') return null

  const img = new Image()
  img.decoding = 'async'
  img.onerror = () => {
    falhas.add(relativo)
    cache.delete(relativo)
  }
  img.src = urlDaArte(relativo)
  cache.set(relativo, img)
  return null
}

/** Aquece o cache. Puramente otimização — nada depende de ter sido chamado. */
export function precarregar(relativos: Iterable<string>): void {
  for (const relativo of relativos) imagem(relativo)
}

/**
 * Tudo que a zona precisa para o quadro seguinte.
 *
 * Chamado na troca de bioma: sem isso a subida de nível mostraria o cenário
 * novo em silhueta por um instante, que é justamente o quadro em que o jogador
 * está olhando.
 */
export function precarregarBioma(bioma: number, assinatura: FormaInimigo): void {
  precarregar([
    // `arteDoCenario` saiu do pré-carregamento junto com o uso: desde o mundo
    // aberto o chão é procedural, e o PNG de cenário era um fundo de tela fixa
    // (608×352, com horizonte) que não ladrilha num jogo visto de cima.
    arteDoProp(bioma),
    arteDoInimigo(assinatura),
    ...Object.values(ARTE_INIMIGO),
    ...Object.values(ARTE_INIMIGO_DANO),
    ...Object.values(ARTE_POSE),
  ])
}

/** Só para teste: devolve o cache ao estado inicial. */
export function limparCacheDeArte(): void {
  cache.clear()
  falhas.clear()
}
