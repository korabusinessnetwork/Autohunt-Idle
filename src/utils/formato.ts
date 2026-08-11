import type { Idioma, Tradutor } from '../lib/i18n'

// Formatação de número e duração.
//
// Número grande aparece em forma legível (1,2 mil / 1.2K) em vez de dígito cru
// — o nível não tem teto (core, 12), então "12483920" na tela é questão de
// tempo, e o Princípio nº1 não aceita isso.

const LOCALIDADE: Record<Idioma, string> = { pt: 'pt-BR', en: 'en-US' }

export function formatarNumero(valor: number, idioma: Idioma): string {
  if (!Number.isFinite(valor)) return '0'
  if (Math.abs(valor) < 10_000) {
    return new Intl.NumberFormat(LOCALIDADE[idioma]).format(valor)
  }
  return new Intl.NumberFormat(LOCALIDADE[idioma], {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(valor)
}

/**
 * Duração legível a partir dos minutos que o SERVIDOR informou. Não há
 * `Date.now()` aqui de propósito: nada na tela de retorno é derivado do
 * relógio local (edge case do core).
 */
export function formatarDuracaoMinutos(minutos: number, t: Tradutor): string {
  const total = Math.max(0, Math.floor(minutos))
  const horas = Math.floor(total / 60)
  const resto = total % 60

  if (horas === 0) return t('tempo.minutos', { valor: resto })
  if (resto === 0) return t('tempo.horas', { valor: horas })
  return t('tempo.horasEMinutos', { horas, minutos: resto })
}
