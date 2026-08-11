import { describe, expect, it } from 'vitest'

import { criarArmazenamento, criarArmazenamentoEmMemoria } from './armazenamento'

// O cenário que motiva este arquivo: em portal, o jogo roda num iframe de
// outro domínio, e a Poki exige que funcione em janela anônima. Nessas
// situações `localStorage` pode LANÇAR, não só devolver `null` — e a sessão
// anônima do Supabase, que é onde o progresso mora, depende dele.

/** Storage que lança em tudo, como em modo de privacidade estrito. */
function storageQueLanca(): Storage {
  const explodir = () => {
    throw new DOMException('acesso negado', 'SecurityError')
  }
  return {
    get length(): number {
      return explodir()
    },
    clear: explodir,
    getItem: explodir,
    key: explodir,
    removeItem: explodir,
    setItem: explodir,
  } as unknown as Storage
}

/** Storage que aceita leitura mas recusa escrita, como cota estourada. */
function storageSemEspaco(): Storage {
  const mapa = new Map<string, string>()
  let sondaPassou = false

  return {
    length: 0,
    clear: () => mapa.clear(),
    key: () => null,
    getItem: (chave: string) => mapa.get(chave) ?? null,
    removeItem: (chave: string) => {
      mapa.delete(chave)
    },
    setItem: (chave: string, valor: string) => {
      // Deixa a sonda passar e só então começa a recusar — é assim que a cota
      // estoura na vida real: no meio da sessão, não na abertura.
      if (!sondaPassou) {
        sondaPassou = true
        mapa.set(chave, valor)
        return
      }
      throw new DOMException('cota estourada', 'QuotaExceededError')
    },
  } as unknown as Storage
}

function storageFuncional(): Storage {
  const mapa = new Map<string, string>()
  return {
    get length() {
      return mapa.size
    },
    clear: () => mapa.clear(),
    key: () => null,
    getItem: (chave: string) => mapa.get(chave) ?? null,
    removeItem: (chave: string) => {
      mapa.delete(chave)
    },
    setItem: (chave: string, valor: string) => {
      mapa.set(chave, valor)
    },
  } as unknown as Storage
}

describe('armazenamento resiliente', () => {
  it('usa o storage do navegador quando ele funciona', () => {
    const arm = criarArmazenamento(storageFuncional())

    arm.setItem('idioma', 'pt')
    expect(arm.getItem('idioma')).toBe('pt')
    expect(arm.persistente).toBe(true)

    arm.removeItem('idioma')
    expect(arm.getItem('idioma')).toBeNull()
  })

  it('cai para memória quando o storage lança, sem propagar o erro', () => {
    const arm = criarArmazenamento(storageQueLanca())

    // O ponto do teste: nada aqui pode lançar. Se lançasse, o jogo abriria
    // em branco em janela anônima.
    expect(() => arm.setItem('idioma', 'en')).not.toThrow()
    expect(arm.getItem('idioma')).toBe('en')
    expect(arm.persistente).toBe(false)
  })

  it('cai para memória quando o storage é ausente', () => {
    const arm = criarArmazenamento(null)
    arm.setItem('idioma', 'pt')
    expect(arm.getItem('idioma')).toBe('pt')
    expect(arm.persistente).toBe(false)
  })

  it('aguenta a cota estourar no meio da sessão', () => {
    const arm = criarArmazenamento(storageSemEspaco())

    expect(() => arm.setItem('sessao', 'token')).not.toThrow()
    // O valor continua legível na sessão corrente, mesmo sem ter persistido.
    expect(arm.getItem('sessao')).toBe('token')
  })

  it('armazenamento em memória se comporta como um storage normal', () => {
    const arm = criarArmazenamentoEmMemoria()

    expect(arm.getItem('nada')).toBeNull()
    arm.setItem('a', '1')
    expect(arm.getItem('a')).toBe('1')
    arm.removeItem('a')
    expect(arm.getItem('a')).toBeNull()
  })
})
