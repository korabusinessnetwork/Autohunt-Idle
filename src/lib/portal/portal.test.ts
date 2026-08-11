// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { criarPortalCrazyGames } from './crazygames'
import { criarPortalDominioProprio } from './dominioProprio'
import { criarPortalPoki } from './poki'
import { ehCanalSuportado, resolverCanal } from './index'

// A camada de portal é o que permite publicar na CrazyGames, na Poki e em
// domínio próprio ao mesmo tempo (nenhum dos dois portais exige exclusividade,
// `docs/01_ARQUITETURA/publicacao-portais.md`). Estes testes guardam as duas
// regras que, se quebrarem, reprovam na revisão do portal: nunca carregar SDK
// sozinho, e nunca mostrar elemento de compra onde é proibido.

const janela = globalThis as unknown as Record<string, unknown>

beforeEach(() => {
  delete janela.CrazyGames
  delete janela.PokiSDK
})

afterEach(() => {
  delete janela.CrazyGames
  delete janela.PokiSDK
  vi.restoreAllMocks()
})

describe('seleção de canal', () => {
  it('reconhece os três canais suportados', () => {
    expect(ehCanalSuportado('crazygames')).toBe(true)
    expect(ehCanalSuportado('poki')).toBe(true)
    expect(ehCanalSuportado('dominio-proprio')).toBe(true)
  })

  it('cai em domínio próprio quando o canal é vazio ou desconhecido', () => {
    // Errar para o lado de "não integra com ninguém" é o padrão seguro: um
    // typo em VITE_CANAL não pode fazer o jogo falar com um portal ausente.
    expect(resolverCanal(undefined)).toBe('dominio-proprio')
    expect(resolverCanal('')).toBe('dominio-proprio')
    expect(resolverCanal('kongregate')).toBe('dominio-proprio')
    expect(resolverCanal('POKI')).toBe('dominio-proprio')
  })

  it('respeita o canal quando ele é válido', () => {
    expect(resolverCanal('poki')).toBe('poki')
    expect(resolverCanal('crazygames')).toBe('crazygames')
  })
})

describe('conformidade de compra por canal', () => {
  it('proíbe elemento de compra nos dois portais', () => {
    // Poki: zero IAP, sem exceção. CrazyGames: só por convite, via Xsolla.
    expect(criarPortalPoki().permiteCompraNoJogo).toBe(false)
    expect(criarPortalCrazyGames().permiteCompraNoJogo).toBe(false)
  })

  it('permite em domínio próprio', () => {
    expect(criarPortalDominioProprio().permiteCompraNoJogo).toBe(true)
  })
})

describe('degradação sem SDK', () => {
  it('CrazyGames: sem SDK na página, o anúncio fica indisponível em vez de quebrar', () => {
    const portal = criarPortalCrazyGames()

    expect(portal.provedorAnuncio?.disponivel()).toBe(false)
    // E os eventos de ciclo de vida viram no-op silencioso.
    expect(() => portal.aoIniciarJogo()).not.toThrow()
    expect(() => portal.aoPausarJogo()).not.toThrow()
    expect(() => portal.aoCarregarProgresso(1)).not.toThrow()
  })

  it('Poki: idem', () => {
    const portal = criarPortalPoki()

    expect(portal.provedorAnuncio?.disponivel()).toBe(false)
    expect(() => portal.aoIniciarJogo()).not.toThrow()
    expect(() => portal.aoCarregarProgresso(0.5)).not.toThrow()
  })

  it('domínio próprio nunca tem provedor de anúncio', () => {
    expect(criarPortalDominioProprio().provedorAnuncio).toBeNull()
  })
})

describe('ciclo de vida com SDK presente', () => {
  it('CrazyGames dispara gameplayStart/Stop e o fim do carregamento', () => {
    const jogo = {
      gameplayStart: vi.fn(),
      gameplayStop: vi.fn(),
      loadingStart: vi.fn(),
      loadingStop: vi.fn(),
    }
    janela.CrazyGames = { SDK: { game: jogo } }

    const portal = criarPortalCrazyGames()
    portal.aoCarregarProgresso(0.4)
    portal.aoCarregarProgresso(1)
    portal.aoIniciarJogo()
    portal.aoPausarJogo()

    expect(jogo.loadingStart).toHaveBeenCalledOnce()
    expect(jogo.loadingStop).toHaveBeenCalledOnce()
    expect(jogo.gameplayStart).toHaveBeenCalledOnce()
    expect(jogo.gameplayStop).toHaveBeenCalledOnce()
  })

  it('Poki dispara os eventos equivalentes', () => {
    const sdk = {
      gameplayStart: vi.fn(),
      gameplayStop: vi.fn(),
      gameLoadingStart: vi.fn(),
      gameLoadingFinished: vi.fn(),
    }
    janela.PokiSDK = sdk

    const portal = criarPortalPoki()
    portal.aoCarregarProgresso(1)
    portal.aoIniciarJogo()
    portal.aoPausarJogo()

    expect(sdk.gameLoadingFinished).toHaveBeenCalledOnce()
    expect(sdk.gameplayStart).toHaveBeenCalledOnce()
    expect(sdk.gameplayStop).toHaveBeenCalledOnce()
  })
})

describe('exibição de anúncio', () => {
  it('CrazyGames devolve `concluido` quando o anúncio termina', async () => {
    janela.CrazyGames = {
      SDK: {
        ad: {
          requestAd: (_tipo: string, manipuladores: { adFinished?: () => void }) => {
            manipuladores.adFinished?.()
          },
        },
      },
    }

    const provedor = criarPortalCrazyGames().provedorAnuncio!
    await expect(provedor.exibir('ticket-1')).resolves.toBe('concluido')
  })

  it('CrazyGames devolve `erro` quando o SDK reporta falha', async () => {
    janela.CrazyGames = {
      SDK: {
        ad: {
          requestAd: (_tipo: string, manipuladores: { adError?: (e: unknown) => void }) => {
            manipuladores.adError?.(new Error('sem inventário'))
          },
        },
      },
    }

    const provedor = criarPortalCrazyGames().provedorAnuncio!
    await expect(provedor.exibir('ticket-1')).resolves.toBe('erro')
  })

  it('CrazyGames recusa um segundo anúncio enquanto o primeiro está em cartaz', async () => {
    let concluir: (() => void) | null = null
    janela.CrazyGames = {
      SDK: {
        ad: {
          requestAd: (_tipo: string, manipuladores: { adFinished?: () => void }) => {
            concluir = () => manipuladores.adFinished?.()
          },
        },
      },
    }

    const provedor = criarPortalCrazyGames().provedorAnuncio!
    const primeiro = provedor.exibir('ticket-1')

    expect(provedor.disponivel()).toBe(false)
    await expect(provedor.exibir('ticket-2')).resolves.toBe('erro')

    concluir!()
    await expect(primeiro).resolves.toBe('concluido')
    expect(provedor.disponivel()).toBe(true)
  })

  it('Poki traduz "não assistiu até o fim" em `interrompido`', async () => {
    janela.PokiSDK = { rewardedBreak: () => Promise.resolve(false) }

    const provedor = criarPortalPoki().provedorAnuncio!
    // Anúncio fechado no meio não pode virar crédito (edge case do core).
    await expect(provedor.exibir('ticket-1')).resolves.toBe('interrompido')
  })

  it('Poki devolve `erro` quando o SDK rejeita', async () => {
    janela.PokiSDK = { rewardedBreak: () => Promise.reject(new Error('bloqueado')) }

    const provedor = criarPortalPoki().provedorAnuncio!
    await expect(provedor.exibir('ticket-1')).resolves.toBe('erro')
  })
})

describe('nenhum adapter injeta script externo', () => {
  it('criar um portal não adiciona nada ao documento', () => {
    // A Poki bloqueia request externo por padrão. Se o adapter carregasse o
    // próprio SDK, seria exatamente esse tipo de chamada.
    const criarElemento = vi.spyOn(document, 'createElement')

    criarPortalCrazyGames()
    criarPortalPoki()
    criarPortalDominioProprio()

    const scriptsCriados = criarElemento.mock.calls.filter(([tag]) => tag === 'script')
    expect(scriptsCriados).toEqual([])
  })
})
