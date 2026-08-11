import { describe, expect, it } from 'vitest'

import { calcularIdade, dataMaximaPermitida, validarDataNascimento } from './idade'

// Gate de idade — restrição CRÍTICA (memory/restrictions.md). A checagem que
// vale de verdade é o trigger no Postgres; estes testes cobrem a camada que dá
// a mensagem boa e evita o jogador descobrir o problema depois de preencher.

const HOJE = new Date('2026-08-11T00:00:00Z')

describe('validação de data de nascimento', () => {
  it('aceita quem tem 18 anos completos', () => {
    expect(validarDataNascimento('2008-08-11', HOJE)).toBe('ok')
    expect(validarDataNascimento('1990-01-01', HOJE)).toBe('ok')
  })

  it('recusa quem faz 18 anos amanhã', () => {
    expect(validarDataNascimento('2008-08-12', HOJE)).toBe('IDADE_MINIMA_NAO_ATINGIDA')
  })

  it('recusa menor de idade com folga', () => {
    expect(validarDataNascimento('2015-03-20', HOJE)).toBe('IDADE_MINIMA_NAO_ATINGIDA')
  })

  it('recusa data no futuro', () => {
    expect(validarDataNascimento('2030-01-01', HOJE)).toBe('DATA_NASCIMENTO_INVALIDA')
  })

  it('recusa data inexistente em vez de deixar o JS "corrigir" pra março', () => {
    expect(validarDataNascimento('2000-02-31', HOJE)).toBe('DATA_NASCIMENTO_INVALIDA')
  })

  it('recusa formato fora de YYYY-MM-DD', () => {
    expect(validarDataNascimento('11/08/1990', HOJE)).toBe('DATA_NASCIMENTO_INVALIDA')
    expect(validarDataNascimento('', HOJE)).toBe('DATA_NASCIMENTO_INVALIDA')
  })

  it('recusa ano implausível (dedo escorregado)', () => {
    expect(validarDataNascimento('0199-05-05', HOJE)).toBe('DATA_NASCIMENTO_INVALIDA')
  })
})

describe('idade completa', () => {
  it('só conta o aniversário depois de ele passar', () => {
    expect(calcularIdade(new Date('2000-12-31T00:00:00Z'), HOJE)).toBe(25)
    expect(calcularIdade(new Date('2000-08-11T00:00:00Z'), HOJE)).toBe(26)
    expect(calcularIdade(new Date('2000-08-12T00:00:00Z'), HOJE)).toBe(25)
  })
})

describe('limite oferecido no seletor', () => {
  it('não deixa escolher uma data que seria recusada', () => {
    const maxima = dataMaximaPermitida(HOJE)
    expect(maxima).toBe('2008-08-11')
    expect(validarDataNascimento(maxima, HOJE)).toBe('ok')
  })
})
