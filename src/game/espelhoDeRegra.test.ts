import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { CICLO_SEGUNDOS, LIMITE_LOTE_SEGUNDOS, MINUTOS_POR_ANUNCIO } from './regrasFarm'
import { CHANCE_DE_PULAR_NIVEL, ITENS_POR_SINTESE, TIER_MAXIMO } from './regrasLoot'
import { FORTIFICACAO_MAXIMA } from './regrasFortificacao'
import { PONTOS_POR_NIVEL } from './regrasAtributos'

// Os módulos `regras*.ts` são ESPELHO das regras do servidor, não fonte — a UI
// os usa para antecipar um número na tela, e os testes puros para exercitar a
// matemática sem subir banco (`docs/03_REGRAS_DE_NEGOCIO/` §1).
//
// Espelho serve para nada se puder divergir em silêncio. Este arquivo é o
// alarme: cada constante espelhada aqui precisa bater com o número que o
// Postgres de fato usa. Quando divergir, **o servidor está certo por
// definição** — ele é quem credita, e o espelho é que precisa ser corrigido.

const PASTA = new URL('../../supabase/migrations/', import.meta.url)

/**
 * Todas as migrations concatenadas em ordem, sem comentário.
 *
 * A ordem importa: uma constante redefinida numa migration posterior sobrescreve
 * a anterior, então o que vale é a ÚLTIMA ocorrência — foi assim que os bônus
 * de conjunto mudaram quando os slots viraram partes do corpo.
 */
const SQL = readdirSync(PASTA)
  .filter((arquivo) => arquivo.endsWith('.sql'))
  .sort()
  .map((arquivo) => readFileSync(new URL(arquivo, PASTA), 'utf8'))
  .join('\n')
  .split('\n')
  .map((linha) => linha.replace(/--.*$/, ''))
  .join('\n')

/** O valor que o Postgres realmente usa: a última definição da constante. */
function constanteDoServidor(nome: string): number {
  const achados = [
    ...SQL.matchAll(new RegExp(`${nome}\\s+constant\\s+\\w+\\s*:=\\s*([0-9.]+)`, 'gi')),
  ]
  expect(achados.length, `${nome} não existe em migration nenhuma`).toBeGreaterThan(0)
  return Number(achados.at(-1)![1])
}

describe('o espelho de regra bate com o servidor', () => {
  it('ciclo, lote e anúncio', () => {
    expect(constanteDoServidor('c_ciclo_segundos')).toBe(CICLO_SEGUNDOS)
    expect(constanteDoServidor('c_limite_lote_segundos')).toBe(LIMITE_LOTE_SEGUNDOS)
    expect(constanteDoServidor('c_minutos_por_anuncio')).toBe(MINUTOS_POR_ANUNCIO)
  })

  it('síntese', () => {
    expect(constanteDoServidor('c_itens_por_sintese')).toBe(ITENS_POR_SINTESE)
    expect(constanteDoServidor('c_chance_pular')).toBe(CHANCE_DE_PULAR_NIVEL)
  })

  it('os tetos que viraram constraint em vez de constante', () => {
    // Estes dois não são `constant` no SQL: o servidor os enforça com `check`,
    // que é mais forte. O espelho precisa conhecer o mesmo número.
    expect(SQL).toContain(`raridade between 1 and ${TIER_MAXIMO}`)
    expect(SQL).toContain(`fortificacao between 0 and ${FORTIFICACAO_MAXIMA}`)
  })

  it('pontos por nível', () => {
    // Ancorado no corpo de `pontos_ganhos_ate`, e não num `* 3` solto: o
    // schema tem multiplicações por 3 em outros lugares, e um teste que casa
    // com qualquer uma delas não prova nada.
    expect(SQL).toContain(`select greatest(0, p_nivel - 1) * ${PONTOS_POR_NIVEL};`)
  })

  it('a Sorte escala igual nos dois lados', () => {
    // Armadilha de leitura: no SQL a divisão é por 4000; no TS, por
    // `SORTE_POR_PONTO * 100`, com SORTE_POR_PONTO = 40. É o MESMO número — o
    // nome em TS é "quanta Sorte vale um ponto percentual". Já pareceu
    // divergência à primeira vista, e não é.
    expect(constanteDoServidor('c_sorte_por_pto')).toBe(4000)

    const ts = readFileSync(new URL('./regrasLoot.ts', import.meta.url), 'utf8')
    const porPonto = Number(/SORTE_POR_PONTO\s*=\s*(\d+)/.exec(ts)![1])
    expect(porPonto * 100).toBe(4000)
  })
})
