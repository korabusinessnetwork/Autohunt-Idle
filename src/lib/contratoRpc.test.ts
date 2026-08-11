import { readFileSync } from 'node:fs'
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
const rpcs = lerMigration('20260811_rpc_farm_e_sessao.sql')
const sqlExecutavel = semComentarios(`${fundacao}\n${rpcs}`)

describe('contrato das RPCs expostas ao jogador', () => {
  it('nenhuma função concedida a `authenticated` aceita parâmetro', () => {
    const concessoes = [
      ...rpcs.matchAll(/grant execute on function public\.(\w+)\(([^)]*)\)\s+to authenticated/gi),
    ]

    expect(concessoes.length).toBeGreaterThan(0)

    for (const [, nome, parametros] of concessoes) {
      // Lista de parâmetros vazia é a garantia: sem campo, não há como o client
      // injetar timestamp, duração ou recompensa (core, 3).
      expect(`${nome}(${parametros!.trim()})`).toBe(`${nome}()`)
    }
  })

  it('as funções que aceitam parâmetro são exclusivas do servidor', () => {
    for (const privilegiada of ['creditar_anuncio', 'aplicar_evento_assinatura']) {
      const revogacao = new RegExp(
        `revoke execute on function public\\.${privilegiada}[\\s\\S]{0,160}?from public, anon, authenticated`,
        'i',
      )
      expect(rpcs).toMatch(revogacao)
      expect(rpcs).toMatch(
        new RegExp(`grant execute on function public\\.${privilegiada}[\\s\\S]{0,160}?to service_role`, 'i'),
      )
    }
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
    ]) {
      const definicao = rpcs.slice(
        rpcs.indexOf(`create or replace function public.${funcao}(`),
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

  it('a data de nascimento não pode ser reescrita depois de informada', () => {
    // Sem isto o jogador teria UPDATE na própria coluna e o gate de idade
    // viraria uma formalidade reversível a qualquer momento.
    expect(fundacao).toContain('DATA_NASCIMENTO_IMUTAVEL')
    expect(fundacao).toMatch(/old\.data_nascimento is not null/i)
  })
})
