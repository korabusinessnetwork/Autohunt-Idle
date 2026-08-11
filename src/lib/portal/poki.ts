import type { DesfechoAnuncio, Portal, ProvedorAnuncio } from './tipos'

// Adapter da Poki.
//
// Dois pontos que o `docs/01_ARQUITETURA/publicacao-portais.md` marca como
// obrigatórios e que o resto do código não teria como saber sozinho:
//   · `gameplayStart` / `gameplayStop` têm regra própria de quando disparar;
//   · **zero elemento de compra**, sob nenhuma circunstância — daí
//     `permiteCompraNoJogo: false`, que a UI respeita.
//
// Continua valendo o risco não resolvido registrado naquele mesmo documento: a
// Poki bloqueia request externo por padrão, e não há confirmação de que uma
// chamada ao Supabase se qualifica na exceção. Se a resposta for "não
// qualifica", este adapter não salva nada — a arquitetura inteira não cabe no
// canal. Ele está aqui pronto para o caso de a resposta ser "qualifica".

interface SdkPoki {
  gameplayStart?: () => void
  gameplayStop?: () => void
  gameLoadingStart?: () => void
  gameLoadingFinished?: () => void
  /** Resolve `true` quando o jogador assistiu até o fim. */
  rewardedBreak?: () => Promise<boolean>
}

function sdk(): SdkPoki | null {
  const global = window as unknown as { PokiSDK?: SdkPoki }
  return global.PokiSDK ?? null
}

function criarProvedor(): ProvedorAnuncio {
  let emExibicao = false

  return {
    nome: 'poki',

    disponivel() {
      return typeof sdk()?.rewardedBreak === 'function' && !emExibicao
    },

    async exibir(): Promise<DesfechoAnuncio> {
      const poki = sdk()
      if (typeof poki?.rewardedBreak !== 'function' || emExibicao) return 'erro'

      emExibicao = true
      try {
        const assistiu = await poki.rewardedBreak()
        return assistiu ? 'concluido' : 'interrompido'
      } catch {
        return 'erro'
      } finally {
        emExibicao = false
      }
    },
  }
}

export function criarPortalPoki(): Portal {
  return {
    canal: 'poki',
    permiteCompraNoJogo: false,
    provedorAnuncio: criarProvedor(),

    aoCarregarProgresso(fracao) {
      const poki = sdk()
      if (fracao >= 1) poki?.gameLoadingFinished?.()
      else poki?.gameLoadingStart?.()
    },
    aoIniciarJogo() {
      sdk()?.gameplayStart?.()
    },
    aoPausarJogo() {
      sdk()?.gameplayStop?.()
    },
  }
}
