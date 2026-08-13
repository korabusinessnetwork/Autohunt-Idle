import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  ABATES_BASE,
  ATAQUE_POR_ABATE,
  CICLO_SEGUNDOS,
  DANO_BASE_POR_CICLO,
  LIMITE_LOTE_SEGUNDOS,
  MINUTOS_POR_ANUNCIO,
  MOEDA_BASE_POR_ABATE,
  XP_BASE_POR_ABATE,
} from './regrasFarm'
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

/**
 * O valor com que uma linha de `ajuste` é semeada.
 *
 * Casa a tupla do `insert` do catálogo: `('chave', valor, minimo, maximo, …`.
 */
function semeadoNoAjuste(chave: string): number {
  const achado = new RegExp(`\\('${chave}',\\s*([0-9.]+),\\s*([0-9.]+),\\s*([0-9.]+)`).exec(SQL)
  expect(achado, `${chave} não é semeada em migration nenhuma`).not.toBeNull()

  const [, valor, minimo, maximo] = achado!
  // A faixa precisa fazer sentido, senão a proteção contra o zero digitado
  // errado não existe de verdade.
  expect(Number(minimo)).toBeLessThanOrEqual(Number(valor))
  expect(Number(maximo)).toBeGreaterThanOrEqual(Number(valor))
  return Number(valor)
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
    // Ancorado no corpo de `pontos_ganhos_ate`, e não num `* 1` solto: o schema
    // tem multiplicações em outros lugares, e um teste que casa com qualquer
    // uma delas não prova nada.
    //
    // E olha a ÚLTIMA ocorrência, não qualquer uma: `pontos_ganhos_ate` já foi
    // redefinida uma vez (3 pontos por nível viraram 1, em
    // `20260829_atributos_manuais.sql`). Um `toContain` simples continuaria
    // passando por causa da definição velha, que segue no histórico e nunca vai
    // sair de lá.
    const corpos = [...SQL.matchAll(/greatest\(0, p_nivel - 1\) \* (\d+);/g)]
    expect(corpos.length, 'pontos_ganhos_ate não existe em migration nenhuma').toBeGreaterThan(0)
    expect(Number(corpos.at(-1)![1])).toBe(PONTOS_POR_NIVEL)
  })

  it('o balanceamento econômico bate com o padrão semeado na tabela `ajuste`', () => {
    // Estas cinco deixaram de ser `constant` no SQL quando o console nasceu
    // (`specs/console-de-ajuste.md`): agora são linhas de `ajuste`, editáveis
    // pelo dono. O espelho passou a espelhar o PADRÃO — o valor semeado, que é
    // também o que `ajuste_num` usa se a linha sumir.
    //
    // Sem este teste, o espelho ficaria sem alarme nenhum: a constante do
    // servidor que ele vigiava simplesmente deixou de existir, e um teste que
    // não encontra o que vigiar passa em silêncio.
    expect(semeadoNoAjuste('abates_base')).toBe(ABATES_BASE)
    expect(semeadoNoAjuste('xp_por_abate_base')).toBe(XP_BASE_POR_ABATE)
    expect(semeadoNoAjuste('moeda_por_abate_base')).toBe(MOEDA_BASE_POR_ABATE)
    expect(semeadoNoAjuste('dano_por_ciclo_base')).toBe(DANO_BASE_POR_CICLO)
    expect(semeadoNoAjuste('ataque_por_abate')).toBe(ATAQUE_POR_ABATE)

    // Ligar o console não mudou o jogo: os multiplicadores globais nascem
    // neutros. Se algum dia nascerem diferentes de 1, é decisão de produto e
    // este teste é onde ela aparece.
    expect(semeadoNoAjuste('xp_multiplicador_global')).toBe(1)
    expect(semeadoNoAjuste('moeda_multiplicador_global')).toBe(1)
  })

  it('o padrão embutido em `resolver_ciclos` repete o valor semeado', () => {
    // A rede de segurança do edge case "a linha sumiu": se o `coalesce` de
    // `ajuste_num` cair num número diferente do semeado, apagar uma linha
    // mudaria o jogo em silêncio — que é exatamente o que o padrão existe para
    // impedir.
    for (const [chave, esperado] of [
      ['abates_base', ABATES_BASE],
      ['xp_por_abate_base', XP_BASE_POR_ABATE],
      ['moeda_por_abate_base', MOEDA_BASE_POR_ABATE],
      ['dano_por_ciclo_base', DANO_BASE_POR_CICLO],
      ['ataque_por_abate', ATAQUE_POR_ABATE],
      ['xp_multiplicador_global', 1],
      ['moeda_multiplicador_global', 1],
    ] as const) {
      const achado = new RegExp(`ajuste_num\\('${chave}',\\s*([0-9.]+)\\)`).exec(SQL)
      expect(achado, `resolver_ciclos não lê ${chave}`).not.toBeNull()
      expect(Number(achado![1]), `o padrão embutido de ${chave} diverge`).toBe(esperado)
    }
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
