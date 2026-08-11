import { describe, expect, it } from 'vitest'

import {
  deveAvisarSobreAssinatura,
  motivoIndisponibilidade,
  tituloDoPainel,
  type ContextoDesbloqueio,
} from './regras'

function contexto(ajustes: Partial<ContextoDesbloqueio> = {}): ContextoDesbloqueio {
  return {
    permiteCompraNoJogo: true,
    assinante: false,
    saldo: 0,
    restantesHoje: 120,
    anuncioDisponivel: true,
    ...ajustes,
  }
}

describe('conformidade de compra por canal', () => {
  it('esconde qualquer menção a assinatura onde o canal proíbe compra', () => {
    // A Poki proíbe elemento de compra sem exceção. O título neutro é o que
    // garante que nem a palavra "assinatura" aparece naquele canal.
    const emPortal = contexto({ permiteCompraNoJogo: false })

    expect(tituloDoPainel(emPortal)).toBe('desbloqueio.titulo')
    expect(deveAvisarSobreAssinatura(emPortal, false)).toBe(false)

    const assinanteEmPortal = contexto({ permiteCompraNoJogo: false, assinante: true })
    expect(tituloDoPainel(assinanteEmPortal)).toBe('desbloqueio.titulo')
  })

  it('mostra o estado da assinatura em domínio próprio', () => {
    expect(tituloDoPainel(contexto({ assinante: false }))).toBe('assinatura.inativa')
    expect(tituloDoPainel(contexto({ assinante: true }))).toBe('assinatura.ativa')
  })

  it('avisa que a assinatura não abriu só para quem poderia comprar', () => {
    expect(deveAvisarSobreAssinatura(contexto(), false)).toBe(true)
    // Já assina: não há o que avisar.
    expect(deveAvisarSobreAssinatura(contexto({ assinante: true }), false)).toBe(false)
    // Checkout aberto: o aviso não faz mais sentido.
    expect(deveAvisarSobreAssinatura(contexto(), true)).toBe(false)
  })
})

describe('quando o anúncio pode ser oferecido', () => {
  it('libera quando há SDK, saldo e teto disponíveis', () => {
    expect(motivoIndisponibilidade(contexto())).toBeNull()
  })

  it('não oferece anúncio a quem já assina', () => {
    expect(motivoIndisponibilidade(contexto({ assinante: true }))).toBe(
      'anuncio.indisponivel.ASSINANTE_NAO_PRECISA',
    )
  })

  it('não oferece anúncio sem SDK do canal', () => {
    expect(motivoIndisponibilidade(contexto({ anuncioDisponivel: false }))).toBe(
      'anuncio.indisponivel.SEM_PROVEDOR',
    )
  })

  it('avisa antes quando o teto diário já foi atingido', () => {
    // O ponto do critério: o jogador descobre ANTES de assistir, não depois de
    // gastar 30 segundos por nada.
    expect(motivoIndisponibilidade(contexto({ restantesHoje: 0 }))).toBe(
      'anuncio.indisponivel.TETO_DIARIO_ATINGIDO',
    )
  })

  it('avisa quando o saldo já está no teto de 2h', () => {
    expect(motivoIndisponibilidade(contexto({ saldo: 120 }))).toBe(
      'anuncio.indisponivel.SALDO_JA_NO_TETO',
    )
  })
})
