import type { DesfechoAnuncio, Portal, ProvedorAnuncio } from './tipos'

// Adapter da CrazyGames.
//
// O SDK é carregado pela página que hospeda o jogo — este arquivo nunca injeta
// script (critério 10 do spec: a Poki bloqueia request externo, e carregar SDK
// por conta própria seria exatamente esse tipo de chamada). Se o SDK não
// estiver presente, o adapter degrada para "sem anúncio" e o jogo roda igual.
//
// Nota de canal: o Basic Launch **não exige SDK nem monetização**
// (`docs/01_ARQUITETURA/publicacao-portais.md`), então este adapter só começa a
// valer de verdade no convite para Full Launch. Ele existe agora para que
// aquele convite não vire uma refatoração.

interface SdkCrazyGames {
  game?: {
    gameplayStart?: () => void
    gameplayStop?: () => void
    loadingStart?: () => void
    loadingStop?: () => void
  }
  ad?: {
    requestAd?: (
      tipo: 'rewarded' | 'midgame',
      manipuladores: {
        adStarted?: () => void
        adFinished?: () => void
        adError?: (erro: unknown) => void
      },
    ) => void
  }
}

function sdk(): SdkCrazyGames | null {
  const global = window as unknown as { CrazyGames?: { SDK?: SdkCrazyGames } }
  return global.CrazyGames?.SDK ?? null
}

function criarProvedor(): ProvedorAnuncio {
  // Um anúncio por vez: se o jogador clicar duas vezes, o segundo pedido é
  // recusado em vez de empilhar duas quebras comerciais.
  let emExibicao = false

  return {
    nome: 'crazygames',

    disponivel() {
      return typeof sdk()?.ad?.requestAd === 'function' && !emExibicao
    },

    exibir(): Promise<DesfechoAnuncio> {
      const anuncio = sdk()?.ad
      if (typeof anuncio?.requestAd !== 'function' || emExibicao) {
        return Promise.resolve('erro')
      }

      emExibicao = true
      return new Promise<DesfechoAnuncio>((resolver) => {
        let resolvido = false
        const encerrar = (desfecho: DesfechoAnuncio) => {
          if (resolvido) return
          resolvido = true
          emExibicao = false
          resolver(desfecho)
        }

        try {
          anuncio.requestAd!('rewarded', {
            adFinished: () => encerrar('concluido'),
            adError: () => encerrar('erro'),
          })
        } catch {
          encerrar('erro')
        }
      })
    },
  }
}

export function criarPortalCrazyGames(): Portal {
  return {
    canal: 'crazygames',
    // IAP na CrazyGames é só por convite e via Xsolla exclusivo
    // (`memory/restrictions.md`) — enquanto isso não existir, nada de compra.
    permiteCompraNoJogo: false,
    provedorAnuncio: criarProvedor(),

    aoCarregarProgresso(fracao) {
      const jogo = sdk()?.game
      if (fracao >= 1) jogo?.loadingStop?.()
      else jogo?.loadingStart?.()
    },
    aoIniciarJogo() {
      sdk()?.game?.gameplayStart?.()
    },
    aoPausarJogo() {
      sdk()?.game?.gameplayStop?.()
    },
  }
}
