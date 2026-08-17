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

/**
 * O corpo da ÚLTIMA definição de uma função — que é a que o Postgres executa.
 *
 * Mesma lógica de `constanteDoServidor`, aplicada a código em vez de número:
 * `create or replace` empilha, e migration nenhuma é apagada do histórico.
 */
function ultimaDefinicaoDeFuncao(nome: string): string {
  const achados = [
    ...SQL.matchAll(
      new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${nome}\\s*\\([\\s\\S]*?\\$\\$;`, 'gi'),
    ),
  ]
  expect(achados.length, `${nome} não existe em migration nenhuma`).toBeGreaterThan(0)
  return achados.at(-1)![0]
}

/** Os literais de uma união de tipo do TypeScript, lidos como texto. */
function uniaoDeTipo(arquivo: string, nome: string): string[] {
  const ts = readFileSync(new URL(arquivo, import.meta.url), 'utf8')
  const linha = new RegExp(`export type ${nome}\\s*=\\s*([^\\n]+)`).exec(ts)
  expect(linha, `${nome} não foi encontrado em ${arquivo}`).not.toBeNull()
  return [...linha![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!)
}

/** A lista de um `check (… in (…))`, na última vez em que a coluna é restringida. */
function listaDoCheck(coluna: string): string[] {
  const achados = [
    ...SQL.matchAll(new RegExp(`check\\s*\\([^)]*?${coluna}\\s+in\\s*\\(([^)]+)\\)`, 'gi')),
  ]
  expect(achados.length, `${coluna} não tem check em migration nenhuma`).toBeGreaterThan(0)
  return [...achados.at(-1)![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!)
}

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

  it('nenhum atributo entra pela metade no poder de ataque', () => {
    // ESTE ARQUIVO SÓ VIGIAVA CONSTANTE NUMÉRICA, e era o buraco: se o TS
    // parasse de somar `secundario / 2` e o SQL não parasse junto, a tela
    // mostraria um número e o servidor creditaria outro — com a suíte inteira
    // verde, porque nenhum teste conhecia `poder_de_ataque`.
    //
    // A única divisão que já existiu neste corpo era a do atributo secundário.
    // Proibir a divisão inteira, em vez de casar o nome da variável, sobrevive a
    // um `rename` — que seria justamente o jeito de a regra voltar sem alarme.
    const corpo = ultimaDefinicaoDeFuncao('poder_de_ataque')

    expect(corpo, 'o secundário voltou a entrar pela metade').not.toMatch(/v_secundario\s*\/\s*2/)
    expect(corpo, 'apareceu uma divisão nova em poder_de_ataque').not.toMatch(/\/\s*2\b/)
  })

  it('os três canais de dano escolhem o mesmo atributo dos dois lados', () => {
    // O espelho de verdade da regra que o dono pediu: o atributo que casa com a
    // arma conta inteiro, e é o MESMO atributo aqui e no Postgres. A tabela sai
    // lida do TS como texto, então acrescentar um quarto canal em
    // `ATRIBUTO_DO_DANO` sem tocar no SQL reprova aqui.
    const equipamento = readFileSync(new URL('./regrasEquipamento.ts', import.meta.url), 'utf8')
    const bloco = /ATRIBUTO_DO_DANO[^=]*=\s*\{([^}]*)\}/.exec(equipamento)
    expect(bloco, 'ATRIBUTO_DO_DANO sumiu de regrasEquipamento.ts').not.toBeNull()

    const pares = [...bloco![1]!.matchAll(/(\w+):\s*'(\w+)'/g)].map((m) => [m[1]!, m[2]!] as const)
    const canais = uniaoDeTipo('../lib/tipos.ts', 'TipoDano')

    expect(new Set(pares.map(([canal]) => canal)), 'a tabela não cobre TipoDano').toEqual(
      new Set(canais),
    )
    expect(canais).toContain('destreza')

    const corpo = ultimaDefinicaoDeFuncao('poder_de_ataque')
    for (const [canal, atributo] of pares) {
      expect(corpo, `poder_de_ataque não conhece o canal ${canal}`).toMatch(
        new RegExp(`'${canal}'`),
      )
      expect(corpo, `poder_de_ataque não lê o atributo ${atributo}`).toMatch(
        new RegExp(`\\b${atributo}\\b`),
      )
    }
  })

  it('o `check` do banco aceita exatamente os canais que o TypeScript declara', () => {
    // `tipo_dano` e `afinidade` guardam a mesma união (`TipoDano | null` em
    // `lib/tipos.ts`). Widenar um e esquecer o outro é o erro barato: o drop de
    // destreza entraria, e a peça com afinidade de destreza seria recusada pelo
    // banco na hora de conceder — falha de escrita, não de leitura.
    const canais = uniaoDeTipo('../lib/tipos.ts', 'TipoDano')

    expect(new Set(listaDoCheck('tipo_dano'))).toEqual(new Set(canais))
    expect(new Set(listaDoCheck('afinidade'))).toEqual(new Set(canais))
  })

  it('o hash que reclassifica arma no SQL é gêmeo do `embaralhar` do TS', () => {
    // A migration que move arco e adaga para o canal de destreza precisa
    // reproduzir `embaralhar(id) % 4` — se errar, ela troca a ARMA de jogadores
    // que já viram o ícone da própria.
    //
    // Ela não porta o FNV-1a inteiro: só os dois bits baixos importam, e eles
    // sobrevivem sozinhos ao XOR e à multiplicação. A recorrência mod 4 usa
    // exatamente `semente mod 4` e `primo mod 4` — por isso os dois números são
    // DERIVADOS aqui do próprio `armas.ts`, e não escritos à mão: mexer na
    // semente ou no primo reprova este teste em vez de reclassificar armas.
    const armas = readFileSync(new URL('./armas.ts', import.meta.url), 'utf8')
    const semente = Number(/let h = (\d+)/.exec(armas)![1])
    const primo = Number(/Math\.imul\(h, (\d+)\)/.exec(armas)![1])

    expect(semente % 4, 'a semente do FNV-1a mudou').toBe(1)
    expect(primo % 4, 'o primo do FNV-1a mudou').toBe(3)

    const corpo = ultimaDefinicaoDeFuncao('canal_historico_da_arma')
    expect(corpo, 'a semente da recorrência diverge').toMatch(
      new RegExp(`:=\\s*${semente % 4}\\b`),
    )
    expect(corpo, 'o XOR sumiu da recorrência').toMatch(/#/)
    expect(corpo, 'a recorrência parou de olhar só os 2 bits baixos').toMatch(/&\s*3\b/)
    expect(corpo, 'o multiplicador da recorrência diverge').toMatch(
      new RegExp(`\\*\\s*${primo % 4}\\b`),
    )
    expect(corpo, 'a recorrência não fecha em mod 4').toMatch(/%\s*4\b/)
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
