// Gate de idade — lógica pura, sem rede.
//
// Esta é a checagem de conveniência: serve para a mensagem ser boa e para o
// jogador não descobrir o problema depois de preencher tudo. A checagem que
// VALE é o trigger `validar_idade_minima` no Postgres — política sem
// enforcement não vale nada (memory/restrictions.md, CRÍTICA).
//
// Produto restrito a 18+ (ECA Digital, Lei 15.211/2025): data de nascimento
// real, nunca checkbox de autodeclaração.

export const IDADE_MINIMA = 18

/** Ano abaixo do qual a data é claramente um dedo escorregado no formulário. */
const ANO_MINIMO_PLAUSIVEL = 1900

export type ResultadoIdade = 'ok' | 'DATA_NASCIMENTO_INVALIDA' | 'IDADE_MINIMA_NAO_ATINGIDA'

/** Idade completa em anos na data de referência. */
export function calcularIdade(dataNascimento: Date, referencia: Date): number {
  let idade = referencia.getUTCFullYear() - dataNascimento.getUTCFullYear()
  const mes = referencia.getUTCMonth() - dataNascimento.getUTCMonth()
  if (mes < 0 || (mes === 0 && referencia.getUTCDate() < dataNascimento.getUTCDate())) {
    idade -= 1
  }
  return idade
}

/** Valida a data de nascimento no formato `YYYY-MM-DD` vinda do `<input date>`. */
export function validarDataNascimento(valor: string, referencia = new Date()): ResultadoIdade {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return 'DATA_NASCIMENTO_INVALIDA'

  const data = new Date(`${valor}T00:00:00Z`)
  if (Number.isNaN(data.getTime())) return 'DATA_NASCIMENTO_INVALIDA'

  // `new Date('2026-02-31')` não é inválida em JS — ela vira 3 de março. Sem
  // esta volta, uma data inexistente passaria batido.
  if (data.toISOString().slice(0, 10) !== valor) return 'DATA_NASCIMENTO_INVALIDA'

  if (data.getTime() > referencia.getTime()) return 'DATA_NASCIMENTO_INVALIDA'
  if (data.getUTCFullYear() < ANO_MINIMO_PLAUSIVEL) return 'DATA_NASCIMENTO_INVALIDA'

  return calcularIdade(data, referencia) >= IDADE_MINIMA ? 'ok' : 'IDADE_MINIMA_NAO_ATINGIDA'
}

/** Data máxima aceitável no seletor — evita oferecer o que será recusado. */
export function dataMaximaPermitida(referencia = new Date()): string {
  const limite = new Date(
    Date.UTC(
      referencia.getUTCFullYear() - IDADE_MINIMA,
      referencia.getUTCMonth(),
      referencia.getUTCDate(),
    ),
  )
  return limite.toISOString().slice(0, 10)
}
