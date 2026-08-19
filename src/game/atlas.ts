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
 * As skins vieram numa pose única, então com skin equipada os três estados
 * apontam para o mesmo arquivo. **Isso deixou de travar o boneco**: desde
 * 2026-08-14 a pose com skin é resolvida por TRANSFORM, em
 * `sprites.ts` (`deslocamentoDoHeroi`) — balanço de passo, avanço no golpe e
 * pulinho na comemoração são gerados, não desenhados. Vale igual com e sem
 * skin, e é o que consertou o relato "equipei a skin e o boneco travou".
 *
 * Arte de pose dedicada por skin (`sk-*-attack.png` e afins) continua sendo
 * MELHORIA possível — nunca pré-requisito. Enquanto ela não existir no disco,
 * não adianta apontar para cá: o teste do atlas confere tabela contra disco, e
 * reprova, corretamente.
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
 * As formas do pool base, para varrer sem repetir a lista.
 *
 * Sai das chaves de `ARTE_INIMIGO` em vez de ser escrita de novo: assim um
 * inimigo base novo entra em UM lugar e já nasce pré-carregado.
 */
const POOL_COM_FOLHA = Object.keys(ARTE_INIMIGO) as FormaBase[]

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
 * O apelido de cada bioma nos arquivos de arte, na ordem dos ids 1–16 de
 * `BIOMAS`. Não é chave de tradução: é nome de arquivo.
 */
export const APELIDO_BIOMA: readonly string[] = [
  // O universo doce.
  'floresta',
  'geleia',
  'deserto',
  'recife',
  'chocolate',
  'geleira',
  'vulcao',
  'cosmico',
  // A fábrica morta.
  'refri',
  'melaco',
  'marzipa',
  'freezer',
  'silo',
  'esteira',
  'caldeira',
  'forno',
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
  latinha: `${RAIZ}/biomas/en-refri.png`,
  tronco: `${RAIZ}/biomas/en-melaco.png`,
  sino: `${RAIZ}/biomas/en-marzipa.png`,
  picole: `${RAIZ}/biomas/en-freezer.png`,
  torrao: `${RAIZ}/biomas/en-silo.png`,
  bala: `${RAIZ}/biomas/en-esteira.png`,
  gota: `${RAIZ}/biomas/en-caldeira.png`,
  caramelo: `${RAIZ}/biomas/en-forno.png`,
}

/**
 * Sob que nome cada forma tem os arquivos de animação dela.
 *
 * DERIVADO, e não escrito à mão. A regra do pacote é uma só, e vale para as 21
 * formas: **a folha de animação usa o mesmo apelido do PNG parado**. O
 * `en-floresta.png` do algodão tem `anim-floresta-idle.png` ao lado; o
 * `en-pudim.png` tem `anim-pudim-idle.png`.
 *
 * Escrever a tabela de novo seria uma terceira lista das mesmas 21 chaves —
 * exatamente a lista que sai de sincronia primeiro, e sem barulho nenhum: uma
 * forma com apelido errado não quebra, ela só para de animar. Derivando, a
 * forma nova entra em `ARTE_INIMIGO` ou `ARTE_ASSINATURA` e já chega animada.
 *
 * O acoplamento que isto cria — a convenção de nome do arquivo — está coberto:
 * `atlas.test.ts` confere no disco todo caminho que este arquivo declara.
 *
 * `Partial` de propósito, e a razão sobrevive à entrega completa: uma forma
 * criada antes da arte dela devolve `null` e cai no PNG parado, em vez de
 * apontar para um caminho inventado.
 */
const APELIDO_DA_FORMA: Partial<Record<FormaInimigo, string>> = Object.fromEntries(
  Object.entries({ ...ARTE_INIMIGO, ...ARTE_ASSINATURA }).map(([forma, parado]) => [
    forma,
    parado.replace(/^.*\/en-/, '').replace(/\.png$/, ''),
  ]),
)

/** Quadros de cada folha. O de dano tem DOIS, e os outros dois têm quatro. */
export const QUADROS_IDLE = 4
export const QUADROS_MORTE = 4
export const QUADROS_LAMPEJO = 2

/**
 * A pasta sai de quem a forma É, e não de uma segunda tabela.
 *
 * O pool base mora em `inimigos/` e o assinatura em `biomas/` — divisão que
 * `ARTE_INIMIGO` e `ARTE_ASSINATURA` já fazem desde sempre. Reusar a pergunta
 * que elas já respondem evita uma terceira lista das mesmas 21 chaves, que é
 * exatamente a lista que sairia de sincronia primeiro.
 */
function folhaDaForma(forma: FormaInimigo, sufixo: string): string | null {
  const apelido = APELIDO_DA_FORMA[forma]
  if (!apelido) return null
  const pasta = forma in ARTE_INIMIGO ? 'inimigos' : 'biomas'
  return `${RAIZ}/${pasta}/anim-${apelido}-${sufixo}.png`
}

/** A folha de repouso da forma, quando ela existe. `null` é resposta válida. */
export function arteDaAnimacaoDoInimigo(forma: FormaInimigo): string | null {
  return folhaDaForma(forma, 'idle')
}

/**
 * A folha de DANO — 2 quadros: o vulto branco do impacto e o corpo de volta.
 *
 * SÓ O ASSINATURA TEM. O pool base resolve o mesmo problema com outro arquivo:
 * ele veio com `-sil`, uma silhueta única desenhada à mão, e uma folha de dois
 * quadros para ele seria a mesma imagem duas vezes. Quem desenha tenta esta
 * primeiro e cai no `-sil` — ver `arteDoDanoDoInimigo`.
 */
export function arteDoLampejoDoInimigo(forma: FormaInimigo): string | null {
  return forma in ARTE_INIMIGO ? null : folhaDaForma(forma, 'hit')
}

/**
 * A folha de MORTE — 4 quadros: o bicho achata contra o chão e vira risco.
 *
 * O desabamento está DESENHADO DENTRO DO QUADRO: os quatro têm a mesma caixa de
 * 160×184 e o corpo escorre para a base dela. Por isso quem desenha trata esta
 * folha como qualquer outra, centrada na posição do bicho — encolher a caixa
 * por fora achataria duas vezes.
 */
export function arteDaMorteDoInimigo(forma: FormaInimigo): string | null {
  return folhaDaForma(forma, 'die')
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

/**
 * A CENA ANIMADA da zona — 4 quadros de 608×352, lado a lado.
 *
 * NÃO É ARTE DE MUNDO, e confundir as duas custaria caro. A folha traz a
 * composição inteira já montada — chão, props e inimigos juntos, respirando —
 * que é exatamente o que o motor desenha ao vivo. Usá-la no jogo desenharia
 * tudo duas vezes, uma delas num enquadramento que não é o da câmera.
 *
 * O lugar dela é onde o jogador ESCOLHE para onde ir.
 */
export function arteDaCenaAnimada(bioma: number): string {
  return `${RAIZ}/biomas/anim-${apelidoDoBioma(bioma)}-scene.png`
}

/** Quadros da cena animada. */
export const QUADROS_CENA = 4

/** O elemento de mundo espalhado sobre o cenário (árvore, duna, plataforma). */
export function arteDoProp(bioma: number): string {
  return `${RAIZ}/biomas/prop-${apelidoDoBioma(bioma)}.png`
}

/**
 * Ladrilhos de chão — 4 variantes de 64×64 por bioma, que EMENDAM.
 *
 * São a resposta para a limitação que `sprites.ts` documenta desde o mundo
 * aberto: `sc-*.png` é cenário de fundo com horizonte, e ladrilhar horizonte num
 * jogo visto de cima vira papel de parede. Estes não têm horizonte — são piso
 * visto de cima, desenhados para emendar nos quatro lados.
 *
 * A variante 1 é a BASE lisa e as 2–4 são acento (rebite, musgo, rachadura,
 * brasa). Quem escolhe qual cai onde é `sprites.ts`, com a mesma regra de
 * sempre: derivada da célula, nunca sorteada, senão o chão ferve quando o
 * jogador anda.
 *
 * OS DEZESSEIS TÊM. Por um dia foi só a fábrica morta, e o comentário aqui
 * dizia que a malha hexagonal era o certo para o universo doce — o que era
 * defesa de uma ausência, não uma decisão de desenho. Com a arte na mão dá para
 * ver: chão desenhado ganha da malha nos dois lados do catálogo, e a malha ficou
 * com o papel que ela faz bem, que é segurar a tela enquanto o PNG não chega.
 */
export const VARIANTES_LADRILHO = 4

/**
 * A folha de animação do prop — 4 quadros do mesmo tamanho do `prop-*.png`
 * parado daquele bioma.
 *
 * O QUADRO NÃO TEM TAMANHO FIXO, e essa é a diferença em relação às folhas de
 * inimigo. Os props do universo doce nasceram em enquadramentos diferentes
 * entre si (o da floresta é 128×176, o da fábrica é 176×176), e a folha de cada
 * um preserva o dele. Quem desenha não precisa saber: `desenharQuadro` divide a
 * largura da folha pela contagem de quadros e descobre sozinho.
 */
export function arteDaAnimacaoDoProp(bioma: number): string {
  return `${RAIZ}/biomas/anim-${apelidoDoBioma(bioma)}-prop.png`
}

/**
 * Um ladrilho do bioma.
 *
 * A variante satura em vez de estourar: ela vem de um hash, e um hash que
 * escape da faixa não pode virar 404 no chão inteiro da tela.
 */
export function arteDoLadrilho(bioma: number, variante: number): string {
  const n = Math.min(VARIANTES_LADRILHO, Math.max(1, Math.trunc(variante) || 1))
  return `${RAIZ}/biomas/tile-${apelidoDoBioma(bioma)}-${n}.png`
}

/** Todos os ladrilhos de um bioma, para pré-carregar de uma vez. */
export function ladrilhosDoBioma(bioma: number): readonly string[] {
  return Array.from({ length: VARIANTES_LADRILHO }, (_, i) => arteDoLadrilho(bioma, i + 1))
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
 *
 * A SKIN ENTRA AQUI desde 2026-08-14, e é conserto de um defeito real: o
 * aquecimento cobria props, inimigos e as três poses, e NENHUMA skin. Quem
 * equipava caía na silhueta geométrica até o PNG decodificar — no exato quadro
 * em que a única coisa que o jogador quer ver é a skin nova. O parâmetro é
 * opcional para quem só quer a zona (e `null` significa "sem skin equipada").
 */
export function precarregarBioma(
  bioma: number,
  assinatura: FormaInimigo,
  raridadeDaSkin: number | null = null,
): void {
  precarregar([
    // `arteDoCenario` saiu do pré-carregamento junto com o uso: desde o mundo
    // aberto o chão é procedural, e o PNG de cenário era um fundo de tela fixa
    // (608×352, com horizonte) que não ladrilha num jogo visto de cima.
    arteDoProp(bioma),
    // Os ladrilhos SIM — e são o item mais urgente da lista. Prop que chega
    // atrasado aparece; chão que chega atrasado é a tela inteira mudando de
    // cara no quadro em que o jogador acabou de viajar.
    ...ladrilhosDoBioma(bioma),
    arteDaAnimacaoDoProp(bioma),
    arteDoInimigo(assinatura),
    // A folha de repouso do assinatura, quando ele tem uma. Sem isto o bicho
    // nasce parado e só começa a respirar quando o PNG decodifica.
    ...(arteDaAnimacaoDoInimigo(assinatura) ? [arteDaAnimacaoDoInimigo(assinatura)!] : []),
    // Dano e morte também, e por um motivo mais forte que o repouso: as duas só
    // aparecem no instante em que o jogador acerta, e baixar a folha NAQUELE
    // quadro perderia justamente o quadro que ela existe para mostrar.
    ...(arteDoLampejoDoInimigo(assinatura) ? [arteDoLampejoDoInimigo(assinatura)!] : []),
    ...(arteDaMorteDoInimigo(assinatura) ? [arteDaMorteDoInimigo(assinatura)!] : []),
    ...Object.values(ARTE_INIMIGO),
    ...Object.values(ARTE_INIMIGO_DANO),
    // As folhas do pool base, que aparece nos dezesseis mapas. Custam mais que
    // as do assinatura (são cinco bichos, não um) e rendem mais pelo mesmo
    // motivo: o jogador vê estes em TODA zona, e não só na que ele abriu.
    ...POOL_COM_FOLHA.flatMap((forma) => [
      arteDaAnimacaoDoInimigo(forma),
      arteDaMorteDoInimigo(forma),
    ]).filter((caminho): caminho is string => caminho !== null),
    ...Object.values(ARTE_POSE),
    // Só a equipada: aquecer as 8 seria baixar sete arquivos que o jogador não
    // tem nenhum direito de ver.
    ...(raridadeDaSkin === null ? [] : [arteDaSkin(raridadeDaSkin)]),
  ])
}

/** Só para teste: devolve o cache ao estado inicial. */
export function limparCacheDeArte(): void {
  cache.clear()
  falhas.clear()
}
