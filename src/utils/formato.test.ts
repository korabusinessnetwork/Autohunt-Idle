import { describe, expect, it } from 'vitest'

import { criarTradutor } from '../lib/i18n'
import { formatarDuracaoMinutos, formatarNumero } from './formato'

const tPt = criarTradutor('pt')
const tEn = criarTradutor('en')

describe('formatação de número', () => {
  it('mostra número pequeno por extenso', () => {
    expect(formatarNumero(0, 'pt')).toBe('0')
    expect(formatarNumero(1234, 'pt')).toBe('1.234')
    expect(formatarNumero(1234, 'en')).toBe('1,234')
  })

  it('compacta número grande em vez de despejar dígito cru', () => {
    // Nível sem teto (core, 12) significa que "12483920" na tela é questão de
    // tempo — e isso não passa no Princípio nº1.
    expect(formatarNumero(1_200_000, 'en')).toBe('1.2M')
    expect(formatarNumero(12_483_920, 'en')).not.toBe('12483920')
    expect(formatarNumero(12_483_920, 'en').length).toBeLessThan(8)
  })

  it('aguenta valor inválido sem quebrar a tela', () => {
    expect(formatarNumero(Number.NaN, 'pt')).toBe('0')
    expect(formatarNumero(Number.POSITIVE_INFINITY, 'en')).toBe('0')
  })
})

describe('formatação de duração', () => {
  it('usa só minutos abaixo de uma hora', () => {
    expect(formatarDuracaoMinutos(45, tPt)).toBe('45 min')
    expect(formatarDuracaoMinutos(0, tEn)).toBe('0 min')
  })

  it('usa só horas quando fecha em hora cheia', () => {
    expect(formatarDuracaoMinutos(120, tPt)).toBe('2h')
    expect(formatarDuracaoMinutos(1440, tEn)).toBe('24h')
  })

  it('combina horas e minutos no resto dos casos', () => {
    expect(formatarDuracaoMinutos(95, tPt)).toBe('1h 35min')
  })

  it('não produz número negativo', () => {
    expect(formatarDuracaoMinutos(-30, tPt)).toBe('0 min')
  })
})
