import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Verificação estrutural das migrations.
//
// Não há Postgres rodando na suíte, então estes testes não executam o SQL —
// eles auditam o contrato dele. É o que impede a regra mais importante do
// produto (o client nunca declara tempo nem recompensa) de ser afrouxada por
// distração numa migration futura: qualquer RPC nova exposta ao jogador com
// parâmetro reprova aqui.

function lerMigration(arquivo: string): string {
  return readFileSync(new URL(`../../supabase/migrations/${arquivo}`, import.meta.url), 'utf8')
}

/** Remove comentários de linha — só o SQL que o Postgres executa interessa. */
function semComentarios(sql: string): string {
  return sql
    .split('\n')
    .map((linha) => linha.replace(/--.*$/, ''))
    .join('\n')
}

const fundacao = lerMigration('20260811_fundacao_jogador_farm.sql')

/**
 * Todas as migrations, em ordem cronológica — é assim que o Postgres as vê.
 * Ler a pasta inteira em vez de listar arquivos garante que uma migration
 * futura entre nesta auditoria sem ninguém precisar lembrar de adicioná-la.
 */
const PASTA_MIGRATIONS = new URL('../../supabase/migrations/', import.meta.url)
const rpcs = readdirSync(PASTA_MIGRATIONS)
  .filter((arquivo) => arquivo.endsWith('.sql'))
  .sort()
  .map((arquivo) => lerMigration(arquivo))
  .join('\n')

const sqlExecutavel = semComentarios(rpcs)

/**
 * As RPCs que creditam valor. Estas continuam obrigadas a ter ZERO parâmetro:
 * sem campo, não há como o client injetar timestamp, duração ou recompensa
 * (core, critério 3).
 */
const RPCS_QUE_CREDITAM = [
  'iniciar_sessao',
  'validar_lote',
  'encerrar_sessao',
  'coletar_farm_offline',
  'emitir_ticket_anuncio',
]

/**
 * Nomes de parâmetro proibidos em QUALQUER RPC exposta ao jogador. É a regra
 * que a versão anterior deste teste realmente queria dizer: o problema nunca
 * foi ter parâmetro, foi o client poder declarar tempo ou ganho. Escolher onde
 * gastar um ponto de atributo é decisão dele; dizer quanto ganhou, não.
 */
const PARAMETROS_PROIBIDOS =
  /timestamp|agora|now|tempo|segundo|minuto|hora|duracao|_xp|moeda|recompensa|abate|nivel|saldo/i

describe('contrato das RPCs expostas ao jogador', () => {
  it('as RPCs que creditam valor não aceitam parâmetro nenhum', () => {
    const concessoes = [
      ...rpcs.matchAll(/grant execute on function public\.(\w+)\(([^)]*)\)\s+to authenticated/gi),
    ]

    expect(concessoes.length).toBeGreaterThan(0)

    const encontradas = concessoes
      .map(([, nome]) => nome!)
      .filter((nome) => RPCS_QUE_CREDITAM.includes(nome))

    // Se uma delas sumir da lista de grants, o teste precisa saber.
    expect(encontradas.sort()).toEqual([...RPCS_QUE_CREDITAM].sort())

    for (const [, nome, parametros] of concessoes) {
      if (!RPCS_QUE_CREDITAM.includes(nome!)) continue
      expect(`${nome}(${parametros!.trim()})`).toBe(`${nome}()`)
    }
  })

  it('nenhuma RPC do jogador aceita parâmetro de tempo ou de recompensa', () => {
    // Cobre também as RPCs que legitimamente têm parâmetro (alocar atributo,
    // definir apelido): elas podem receber escolhas, nunca ganhos.
    const definicoes = [
      ...rpcs.matchAll(
        /create or replace function public\.(\w+)\(([\s\S]*?)\)\s*returns/gi,
      ),
    ]

    // Só as funções concedidas ao JOGADOR entram na regra. As de
    // `service_role` são chamadas por Edge Function e legitimamente recebem
    // `p_minutos`, `p_player_id` e afins.
    const expostas = new Set(
      [
        ...rpcs.matchAll(
          /grant execute on function public\.(\w+)\([^)]*\)\s+to authenticated/gi,
        ),
      ].map(([, nome]) => nome!),
    )
    expect(expostas.size).toBeGreaterThan(0)

    for (const [, nome, assinatura] of definicoes) {
      if (!expostas.has(nome!)) continue
      const parametros = [...assinatura!.matchAll(/\bp_(\w+)/g)].map(([campo]) => campo)

      for (const parametro of parametros) {
        expect(parametro, `${nome} não pode receber ${parametro}`).not.toMatch(
          PARAMETROS_PROIBIDOS,
        )
      }
    }
  })

  it('as funções internas de loot são exclusivas do servidor', () => {
    // Se o jogador alcançasse qualquer uma delas, escolheria a própria
    // raridade ou concederia item a si mesmo.
    for (const interna of [
      'conceder_item',
      'resolver_drops',
      'creditar_ciclos',
      'resolver_uma_dungeon',
      'resolver_dungeons',
    ]) {
      expect(rpcs, interna).toMatch(
        new RegExp(
          `revoke execute on function\\s+public\\.${interna}[\\s\\S]{0,160}?from public, anon, authenticated`,
          'i',
        ),
      )
    }
  })

  it('as funções que aceitam parâmetro são exclusivas do servidor', () => {
    for (const privilegiada of [
      'creditar_anuncio',
      'aplicar_evento_assinatura',
      // Resgate atestado pelo client: o `player_id` vem do JWT conferido na
      // Edge Function, nunca do corpo da requisição — por isso o jogador não
      // pode alcançar esta função direto.
      'resgatar_anuncio_do_jogador',
    ]) {
      const revogacao = new RegExp(
        `revoke execute on function public\\.${privilegiada}[\\s\\S]{0,160}?from public, anon, authenticated`,
        'i',
      )
      expect(rpcs, privilegiada).toMatch(revogacao)
      expect(rpcs).toMatch(
        new RegExp(`grant execute on function public\\.${privilegiada}[\\s\\S]{0,160}?to service_role`, 'i'),
      )
    }
  })

  it('a resolução de recompensa não conhece skin (critério 15 da spec de dungeon)', () => {
    // Prova estrutural de que skin é puramente cosmética: a função que decide
    // XP, moeda e Vitalidade não recebe nem consulta skin nenhuma. Não é
    // promessa de documentação — não existe caminho para ela influenciar.
    const inicio = rpcs.lastIndexOf('create or replace function public.resolver_ciclos(')
    expect(inicio).toBeGreaterThan(-1)

    const corpo = rpcs.slice(inicio, rpcs.indexOf('$$;', inicio)).toLowerCase()
    expect(corpo).not.toContain('skin')
    expect(corpo).not.toContain('equipado')
    expect(corpo).not.toContain('item_jogador')
  })

  it('as RPCs de sessão e farm são SECURITY DEFINER', () => {
    for (const funcao of [
      'iniciar_sessao',
      'validar_lote',
      'encerrar_sessao',
      'coletar_farm_offline',
      'emitir_ticket_anuncio',
      'creditar_anuncio',
      'aplicar_evento_assinatura',
      'resgatar_anuncio_do_jogador',
      'aplicar_credito_anuncio',
      'creditar_ciclos',
      'resolver_drops',
      'conceder_item',
      'resolver_uma_dungeon',
      'resolver_dungeons',
      'iniciar_dungeon',
      'sintetizar',
      'equipar_item',
    ]) {
      const definicao = rpcs.slice(
        rpcs.lastIndexOf(`create or replace function public.${funcao}(`),
      )
      const corpo = definicao.slice(0, definicao.indexOf('$$'))
      expect(corpo, `${funcao} precisa ser SECURITY DEFINER`).toMatch(/security definer/i)
      // `search_path` fixo evita sequestro de resolução de nome numa função
      // que roda com os privilégios do dono.
      expect(corpo, `${funcao} precisa fixar search_path`).toMatch(/set search_path/i)
    }
  })

  it('o tempo do cálculo vem sempre de now() do Postgres', () => {
    const trecho = rpcs.slice(rpcs.indexOf('create or replace function public.iniciar_sessao'))
    expect(trecho).toContain('extract(epoch from (now() - v_fs.last_seen_at))')
  })
})

describe('isolamento e segurança do schema', () => {
  it('toda tabela criada tem RLS habilitada', () => {
    const tabelas = [...fundacao.matchAll(/create table if not exists public\.(\w+)/gi)].map(
      (m) => m[1]!,
    )
    expect(tabelas.length).toBeGreaterThan(0)

    for (const tabela of tabelas) {
      expect(fundacao).toMatch(
        new RegExp(`alter table public\\.${tabela}\\s+enable row level security`, 'i'),
      )
    }
  })

  it('toda tabela tem ao menos uma policy de leitura própria', () => {
    const tabelas = [...fundacao.matchAll(/create table if not exists public\.(\w+)/gi)].map(
      (m) => m[1]!,
    )

    for (const tabela of tabelas) {
      expect(fundacao).toMatch(new RegExp(`create policy \\w+ on public\\.${tabela}`, 'i'))
    }
  })

  it('não existe tenant_id em nenhuma instrução (ADR-002)', () => {
    // Os comentários das migrations citam `tenant_id` justamente para explicar
    // que ele não existe aqui — o que vale auditar é o SQL executável.
    expect(sqlExecutavel.toLowerCase()).not.toContain('tenant_id')
  })

  it('o jogador não recebe UPDATE em coluna de progressão', () => {
    const grant = fundacao.match(/grant update \(([^)]*)\)\s+on public\.jogador/i)
    expect(grant).not.toBeNull()

    const colunas = grant![1]!.split(',').map((c) => c.trim())
    for (const proibida of ['nivel', 'xp_total', 'moeda', 'vitalidade_atual']) {
      expect(colunas).not.toContain(proibida)
    }
  })

  it('o gate de 18+ é enforcado por trigger, não só pelo formulário', () => {
    expect(fundacao).toMatch(/create trigger jogador_valida_idade/i)
    expect(fundacao).toContain('IDADE_MINIMA_NAO_ATINGIDA')
    expect(fundacao).toContain("current_date - interval '18 years'")
  })

  it('o apelido é único, sem diferenciar maiúscula de minúscula', () => {
    // "Duda" e "duda" são o mesmo nome aos olhos do jogador; deixar os dois
    // coexistirem devolveria a personificação pela porta dos fundos.
    expect(rpcs).toMatch(
      /create unique index[\s\S]{0,80}on public\.jogador \(lower\(apelido\)\)/i,
    )
  })

  it('entrar no placar exige identidade permanente', () => {
    // Sem cadastro, um nome único ficaria preso a uma conta anônima que
    // ninguém consegue recuperar — e o nome, ocupado para sempre.
    const definir = rpcs.slice(rpcs.lastIndexOf('create or replace function public.definir_apelido'))
    const corpo = definir.slice(0, definir.indexOf('$$;'))

    expect(corpo).toContain('public.identidade_verificada')
    expect(corpo).toContain('CADASTRO_NECESSARIO')
    // E a colisão é decidida pelo índice, não por uma consulta prévia: entre
    // "verificar se está livre" e "gravar" cabe outro jogador gravando igual.
    expect(corpo).toContain('unique_violation')
    expect(corpo).toContain('APELIDO_EM_USO')
  })

  it('a data de nascimento não pode ser reescrita depois de informada', () => {
    // Sem isto o jogador teria UPDATE na própria coluna e o gate de idade
    // viraria uma formalidade reversível a qualquer momento.
    expect(fundacao).toContain('DATA_NASCIMENTO_IMUTAVEL')
    expect(fundacao).toMatch(/old\.data_nascimento is not null/i)
  })
})
