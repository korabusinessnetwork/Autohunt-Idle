// Armazenamento resiliente.
//
// Por que isto existe: em portal, o jogo roda dentro de um iframe de outro
// domínio, e a Poki exige explicitamente que ele funcione em janela anônima
// (`docs/01_ARQUITETURA/publicacao-portais.md`). Nessas duas situações o
// acesso a `localStorage` pode **lançar exceção**, não só devolver `null` —
// então `window.localStorage?.getItem(...)` não protege: o `?.` cobre a
// ausência do objeto, não o erro na leitura.
//
// Quando o armazenamento persistente não dá, o jogo continua em memória: a
// sessão anônima vale enquanto a aba estiver aberta. É pior que persistir, mas
// é infinitamente melhor que tela branca (Princípio nº1).

export interface Armazenamento {
  getItem(chave: string): string | null
  setItem(chave: string, valor: string): void
  removeItem(chave: string): void
  /** `false` quando estamos no fallback em memória. */
  readonly persistente: boolean
}

const CHAVE_SONDA = '__autohunt_sonda__'

/** Escreve e apaga uma chave descartável para saber se dá mesmo pra usar. */
function utilizavel(fonte: Storage): boolean {
  try {
    fonte.setItem(CHAVE_SONDA, '1')
    fonte.removeItem(CHAVE_SONDA)
    return true
  } catch {
    return false
  }
}

export function criarArmazenamentoEmMemoria(): Armazenamento {
  const mapa = new Map<string, string>()
  return {
    persistente: false,
    getItem: (chave) => mapa.get(chave) ?? null,
    setItem: (chave, valor) => {
      mapa.set(chave, valor)
    },
    removeItem: (chave) => {
      mapa.delete(chave)
    },
  }
}

/**
 * Envolve uma `Storage` do navegador. Cada operação continua dentro de
 * `try/catch` mesmo depois da sonda passar — a cota pode estourar no meio da
 * sessão, e um `setItem` que falha não pode derrubar o jogo.
 */
export function criarArmazenamento(fonte: Storage | null | undefined): Armazenamento {
  if (!fonte || !utilizavel(fonte)) return criarArmazenamentoEmMemoria()

  const reserva = criarArmazenamentoEmMemoria()

  return {
    persistente: true,
    getItem(chave) {
      try {
        return fonte.getItem(chave) ?? reserva.getItem(chave)
      } catch {
        return reserva.getItem(chave)
      }
    },
    setItem(chave, valor) {
      try {
        fonte.setItem(chave, valor)
      } catch {
        // Cota estourada ou permissão revogada no meio da sessão: guarda em
        // memória para a sessão corrente continuar coerente.
        reserva.setItem(chave, valor)
      }
    },
    removeItem(chave) {
      try {
        fonte.removeItem(chave)
      } catch {
        /* nada a fazer — a chave já é inalcançável */
      }
      reserva.removeItem(chave)
    },
  }
}

let instancia: Armazenamento | null = null

/** Armazenamento único do jogo. */
export function obterArmazenamento(): Armazenamento {
  if (instancia) return instancia

  let fonte: Storage | null = null
  try {
    fonte = typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    // Só de ACESSAR `window.localStorage` já dá erro em algumas configurações
    // de privacidade — por isso o acesso está dentro do try, não só o uso.
    fonte = null
  }

  instancia = criarArmazenamento(fonte)
  return instancia
}
