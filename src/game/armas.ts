// A arma decide o ataque — e o ícone.
//
// Este módulo existe porque as duas coisas precisavam sair do MESMO lugar. A
// família da arma (espada, arco, cajado…) já era escolhida por um hash do id do
// item, só que apenas para desenhar o ícone da mochila: no combate, toda arma
// disparava a mesma bolinha (`specs/mapas-instanciados-combate-e-hud.md`, 8).
//
// Se o combate tivesse a própria tabela, um item que mostra uma espada poderia
// atirar como um cajado — e ninguém perceberia até o jogador reclamar. Aqui a
// família é calculada uma vez, e `atlas.ts` (ícone) e `mundo.ts` (combate) leem
// a mesma resposta.
//
// NADA AQUI CREDITA. Alcance, cadência e dano mudam o que acontece na tela; o
// servidor continua creditando por tempo × poder e não sabe qual arma está na
// mão. Adulterar um número deste arquivo no navegador rende exatamente o mesmo
// que não adulterar — a mesma propriedade de `ajustes.ts` e de `mundo.ts`.

import type { TipoDano } from '../lib/tipos'

// AS TRÊS LISTAS ABAIXO SÃO CARGA, NÃO ESTÉTICA.
//
// Até 2026-08-14 havia duas: 4 famílias físicas e 2 mágicas. Com o canal de
// destreza, arco e adaga saíram do físico — e a família de TODA arma já
// existente precisava continuar exatamente a mesma, porque ela sai de
// `embaralhar(id) % familias.length` e o jogador já viu o ícone dela.
//
// A conta que preserva a identidade, e que a ordem de `ARMAS_DESTREZA` encarna:
// a lista física tinha 4 elementos, a nova tem 2, e `h % 2 = (h % 4) % 2`.
//
//   h%4 = 0  espada   → h%2 = 0 → ARMAS_FISICAS[0]  = espada    (fica)
//   h%4 = 3  martelo  → h%2 = 1 → ARMAS_FISICAS[1]  = martelo   (fica)
//   h%4 = 1  adaga    → h%2 = 1 → ARMAS_DESTREZA[1] = adaga     (muda de canal)
//   h%4 = 2  arco     → h%2 = 0 → ARMAS_DESTREZA[0] = arco      (muda de canal)
//
// Por isso `ARMAS_DESTREZA` é `['arco', 'adaga']` e não a ordem intuitiva:
// escrever `['adaga', 'arco']` troca a arma de metade dos jogadores EM SILÊNCIO
// — nenhum tipo muda, nenhum teste genérico reprova. O alarme é o teste de
// preservação de identidade em `armas.test.ts`, que replica a tabela antiga
// como oráculo.

/** As 2 famílias físicas — canal de Força. */
export const ARMAS_FISICAS = ['espada', 'martelo'] as const
/** As 2 famílias de destreza — canal de Destreza. Ordem = carga (ver acima). */
export const ARMAS_DESTREZA = ['arco', 'adaga'] as const
/** As 2 famílias mágicas — canal de Inteligência. */
export const ARMAS_MAGICAS = ['cajado', 'varinha'] as const

export type FamiliaArma =
  | (typeof ARMAS_FISICAS)[number]
  | (typeof ARMAS_DESTREZA)[number]
  | (typeof ARMAS_MAGICAS)[number]

/** As famílias possíveis de cada canal de dano. */
const FAMILIAS_DO_CANAL: Record<TipoDano, readonly FamiliaArma[]> = {
  fisico: ARMAS_FISICAS,
  destreza: ARMAS_DESTREZA,
  magico: ARMAS_MAGICAS,
}

/**
 * Hash estável do id do item.
 *
 * Precisa ser estável por dois motivos agora: o ícone não pode mudar quando a
 * lista reordena (motivo original), e a arma não pode virar outra no meio da
 * partida (motivo novo).
 *
 * DESDE 2026-08-14 ESTA FUNÇÃO TEM UMA GÊMEA EM SQL: `canal_historico_da_arma`
 * (migration `20260830`), que decide quais armas já concedidas migram para o
 * canal de destreza. A gêmea NÃO reimplementa o FNV-1a de 32 bits — só os dois
 * bits baixos importam, e eles sobrevivem sozinhos ao XOR e à multiplicação
 * (2166136261 mod 4 = 1, 16777619 mod 4 = 3). O contrato entre as duas é
 * exatamente esse: `embaralhar(id) % 4`. Mudar a semente ou o primo daqui
 * reclassifica arma de jogador — e `espelhoDeRegra.test.ts` reprova antes.
 */
export function embaralhar(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** A família de uma arma, a partir do id e do tipo de dano que o servidor deu. */
export function familiaDaArma(id: string, tipoDano: TipoDano | null): FamiliaArma {
  // Arma sem tipo de dano cai no físico — decisão escrita, não sobra de `else`:
  // é o mesmo `coalesce(v_arma.tipo_dano, 'fisico')` do Postgres e o mesmo
  // padrão de `calcularPoderDeAtaque`. Os três precisam concordar, senão o
  // ícone mostra uma coisa e o poder conta outra.
  const familias = FAMILIAS_DO_CANAL[tipoDano ?? 'fisico']
  return familias[embaralhar(id) % familias.length]!
}

/**
 * O que a arma faz na tela.
 *
 * Os números são MULTIPLICADORES sobre os ajustes do console
 * (`heroi_alcance_tiro`, `heroi_recarga_tiro`, `heroi_dano_projetil`), e não
 * valores absolutos. É o que mantém o console mandando: o dono continua
 * regulando o jogo inteiro em três controles, e a arma continua sendo a
 * diferença relativa entre uma e outra.
 */
export interface PerfilArma {
  familia: FamiliaArma | 'punho'
  /** `true` = golpe de corpo (não cria projétil nenhum). */
  corpo: boolean
  /** Multiplicador de alcance sobre `heroi_alcance_tiro`. */
  alcance: number
  /** Multiplicador de cadência sobre `heroi_recarga_tiro`. Menor = mais rápido. */
  recarga: number
  /** Multiplicador de dano sobre `heroi_dano_projetil`. */
  dano: number
  /**
   * Abertura do golpe de corpo, em radianos. Só o martelo pega vários inimigos
   * de uma vez — é o que compensa ele ser o mais lento e o de menor alcance.
   */
  arco: number
  /** O desenho do projétil, para quem tem projétil. */
  projetil: 'flecha' | 'magia' | null
}

/**
 * Sem arma equipada o herói soca.
 *
 * Não é caso de exceção escondido: jogador novo abre o jogo sem nada equipado,
 * e precisa conseguir bater em alguma coisa nos primeiros cinco segundos
 * (Princípio nº1).
 */
export const PERFIL_PUNHO: PerfilArma = {
  familia: 'punho',
  corpo: true,
  alcance: 0.16,
  recarga: 1,
  dano: 0.6,
  arco: 1,
  projetil: null,
}

/**
 * Os seis perfis.
 *
 * A leitura que o dono pediu, em uma linha cada: espada é corpo de alcance
 * médio; martelo e adaga são corpo de alcance baixo; arco solta flecha; cajado e
 * varinha soltam ataque de longe — **longe, não infinito**.
 *
 * O alcance sai de `heroi_alcance_tiro` (210 no padrão), então: adaga ≈ 42px,
 * martelo ≈ 46px, espada ≈ 82px, varinha ≈ 210px, cajado ≈ 273px, arco ≈ 315px.
 */
export const PERFIS_DE_ARMA: Record<FamiliaArma, PerfilArma> = {
  espada: {
    familia: 'espada',
    corpo: true,
    alcance: 0.39,
    recarga: 0.9,
    dano: 1.3,
    arco: 1.3,
    projetil: null,
  },
  adaga: {
    familia: 'adaga',
    corpo: true,
    alcance: 0.2,
    recarga: 0.4,
    dano: 0.7,
    arco: 0.9,
    projetil: null,
  },
  martelo: {
    familia: 'martelo',
    corpo: true,
    alcance: 0.22,
    recarga: 1.5,
    dano: 2.6,
    arco: 1.9,
    projetil: null,
  },
  arco: {
    familia: 'arco',
    corpo: false,
    alcance: 1.5,
    recarga: 1,
    dano: 1,
    arco: 0,
    projetil: 'flecha',
  },
  cajado: {
    familia: 'cajado',
    corpo: false,
    alcance: 1.3,
    recarga: 1.35,
    dano: 1.7,
    arco: 0,
    projetil: 'magia',
  },
  varinha: {
    familia: 'varinha',
    corpo: false,
    alcance: 1,
    recarga: 0.65,
    dano: 0.85,
    arco: 0,
    projetil: 'magia',
  },
}

/** O perfil de combate de uma arma equipada, ou o punho quando não há arma. */
export function perfilDaArma(
  arma: { id: string; tipoDano: TipoDano | null } | null | undefined,
): PerfilArma {
  if (!arma) return PERFIL_PUNHO
  return PERFIS_DE_ARMA[familiaDaArma(arma.id, arma.tipoDano)]
}
