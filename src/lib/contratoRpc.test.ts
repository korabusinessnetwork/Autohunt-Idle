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

    // Sem duplicata: desde a migration 20260823 a superfície do client é
    // reconcedida em bloco, então a mesma função aparece em mais de um grant.
    const encontradas = [
      ...new Set(
        concessoes.map(([, nome]) => nome!).filter((nome) => RPCS_QUE_CREDITAM.includes(nome)),
      ),
    ]

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
      // Crédito de diamante comprado com dinheiro: só entra por webhook
      // assinado, mesmo padrão da assinatura (critério 9 da spec da loja).
      'creditar_diamante',
      // Ativação de passe: mesmo padrão, mesmo motivo — quem pagou é o webhook
      // do gateway que diz, nunca o client.
      'ativar_passe',
      'desativar_passe',
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

  it('falhar uma fortificação nunca rebaixa o item', () => {
    // Prova central do critério 7 da spec de fortificação, e do princípio
    // "progresso nunca é punido" que já custou o permadeath ao projeto: não
    // existe, em migration nenhuma, um caminho que reduza `fortificacao`.
    expect(sqlExecutavel).not.toMatch(/fortificacao\s*=\s*fortificacao\s*-/i);
    expect(sqlExecutavel).not.toMatch(/fortificacao\s*=\s*greatest\(0,\s*fortificacao\s*-/i);
    // O único update dela é o incremento, dentro do caminho de sucesso.
    const incrementos = sqlExecutavel.match(/set fortificacao = fortificacao \+ 1/gi) ?? [];
    expect(incrementos.length).toBeGreaterThan(0);
  })

  it('nenhuma rota vende pedra de fortificação', () => {
    // Critério 3: pedra é loot, não mercadoria. Se algum dia existir uma loja,
    // este teste é quem acusa se ela passar a vender pedra — que é o que
    // reabriria a restrição de recompensa aleatória paga.
    const linhas = sqlExecutavel.split('\n')
    const suspeitas = linhas.filter(
      (linha) => /pedra_/i.test(linha) && /(preco|comprar|loja|diamante|venda)/i.test(linha),
    )
    expect(suspeitas).toEqual([])
  })

  it('o único débito de diamante do schema é a compra de ouro', () => {
    // Critério 7 da spec da loja. Diamante só pode sair do saldo virando ouro
    // — e ouro é item de jogo, não valor transferível. Se um dia aparecer um
    // segundo débito (presente para outro jogador, "conversão", saque), ele
    // reprova aqui antes de existir em produção.
    const debitos = [...sqlExecutavel.matchAll(/diamante\s*=\s*diamante\s*-/gi)]
    expect(debitos.length).toBe(1)

    const inicio = sqlExecutavel.lastIndexOf('create or replace function public.comprar_ouro(')
    expect(inicio).toBeGreaterThan(-1)
    const fim = sqlExecutavel.indexOf('$$;', inicio)
    expect(debitos[0]!.index).toBeGreaterThan(inicio)
    expect(debitos[0]!.index).toBeLessThan(fim)
  })

  it('a quantidade de ouro do pacote é fixa, nunca sorteada', () => {
    // Critério 3: "X diamantes entregam sempre exatamente Y ouro". O que
    // transformaria isso em recompensa aleatória paga — a restrição CRÍTICA
    // permanente — é justamente um sorteio no meio do caminho.
    const inicio = sqlExecutavel.lastIndexOf('create or replace function public.comprar_ouro(')
    const corpo = sqlExecutavel.slice(inicio, sqlExecutavel.indexOf('$$;', inicio)).toLowerCase()

    for (const proibido of ['random(', 'sorteio01', 'escalar_raridade', 'conceder_item']) {
      expect(corpo, `comprar_ouro não pode usar ${proibido}`).not.toContain(proibido)
    }
    // O ouro creditado é a coluna do pacote, lida do servidor — não um valor
    // vindo do client nem calculado na hora.
    expect(corpo).toContain('moeda + v_pacote.ouro')
  })

  it('nenhuma rota converte diamante, ouro ou item em dinheiro', () => {
    // Critério 8, e a restrição que sustenta vender diamante como moeda de
    // jogo: sem caminho de volta para dinheiro, não há transmissão de valor
    // entre pessoas para regular.
    const SAIDA_EM_DINHEIRO =
      /\b(saque|sacar|resgatar_saldo|reembolso|estorno|estornar|payout|withdraw|cash_?out|transferir_para_jogador)\b/i
    expect(sqlExecutavel).not.toMatch(SAIDA_EM_DINHEIRO)

    // E a rota que existe entre jogadores também não: não há nenhuma. Um
    // update de saldo cujo alvo não seja `auth.uid()` nem o `p_player_id` de
    // uma função de service_role seria o começo dela.
    expect(sqlExecutavel).not.toMatch(/diamante\s*=\s*diamante\s*\+[\s\S]{0,120}?p_destinatario/i)
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
      'fortificar_item',
      'comprar_ouro',
      'creditar_diamante',
      'ativar_passe',
      'desativar_passe',
      'progredir_passe',
      'conceder_recompensa_passe',
      'exportar_meus_dados',
      'excluir_minha_conta',
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

  it('a recompensa do passe nunca é sorteada', () => {
    // A diferença entre este passe e uma caixa de recompensa aleatória paga —
    // a restrição CRÍTICA permanente — é que o jogador lê a recompensa de cada
    // tier ANTES de comprar. Um sorteio no caminho apagaria essa diferença sem
    // mudar uma linha da tela.
    const inicio = sqlExecutavel.lastIndexOf(
      'create or replace function public.conceder_recompensa_passe(',
    )
    expect(inicio).toBeGreaterThan(-1)
    const corpo = sqlExecutavel.slice(inicio, sqlExecutavel.indexOf('$$;', inicio)).toLowerCase()

    for (const proibido of ['sorteio01', 'escalar_raridade', 'random(', 'conceder_item']) {
      expect(corpo, `conceder_recompensa_passe não pode usar ${proibido}`).not.toContain(proibido)
    }
    // A raridade sai da linha da trilha, não de um cálculo.
    expect(corpo).toContain('v_r.raridade')
  })

  it('nada na trilha do passe expira', () => {
    // "Sem dark pattern de urgência" (`memory/restrictions.md`). Passe de
    // mercado usa temporada com prazo justamente para empurrar compra; a spec
    // de origem decidiu o contrário, e isso é a ausência de uma coluna.
    const inicio = sqlExecutavel.indexOf('create table if not exists public.passe_recompensa')
    expect(inicio).toBeGreaterThan(-1)
    const tabela = sqlExecutavel.slice(inicio, sqlExecutavel.indexOf(');', inicio)).toLowerCase()

    for (const proibida of ['expira', 'validade', 'temporada', 'prazo', 'termina']) {
      expect(tabela, `a trilha não pode ter coluna de ${proibida}`).not.toContain(proibida)
    }
  })

  it('recompensa de passe já destravada nunca é retirada', () => {
    // Critério 4 da spec de origem, e o mesmo princípio que já protege a
    // fortificação: progresso não é punido. Desativar o passe para o ganho de
    // pontos e não toca em item nenhum.
    expect(sqlExecutavel).not.toMatch(/delete\s+from\s+public\.item_jogador[\s\S]{0,200}?'passe'/i)
    expect(sqlExecutavel).not.toMatch(/delete\s+from\s+public\.item_jogador[\s\S]{0,200}?exclusivo/i)

    const inicio = sqlExecutavel.lastIndexOf('create or replace function public.desativar_passe(')
    const corpo = sqlExecutavel.slice(inicio, sqlExecutavel.indexOf('$$;', inicio)).toLowerCase()
    expect(corpo).not.toContain('item_jogador')
    expect(corpo).not.toContain('delete')
  })

  it('só a trilha do passe concede item exclusivo', () => {
    // É o que sustenta a exclusividade da skin (critério 9): não é uma promessa
    // de conteúdo, é a única escrita da coluna no schema inteiro.
    const escritas = [...sqlExecutavel.matchAll(/exclusivo_do_passe/gi)]
    // Coluna, comentário já removido, e o insert da trilha.
    expect(escritas.length).toBeGreaterThan(0)

    const inserts = [
      ...sqlExecutavel.matchAll(/insert into public\.item_jogador\s*\(([^)]*)\)/gi),
    ].filter(([, colunas]) => /exclusivo_do_passe/i.test(colunas!))

    expect(inserts.length, 'só um insert marca item como exclusivo').toBe(1)

    const inicio = sqlExecutavel.lastIndexOf(
      'create or replace function public.conceder_recompensa_passe(',
    )
    const fim = sqlExecutavel.indexOf('$$;', inicio)
    expect(inserts[0]!.index).toBeGreaterThan(inicio)
    expect(inserts[0]!.index).toBeLessThan(fim)
  })

  it('o client nunca informa progresso de passe nem se declara portador', () => {
    for (const funcao of ['ativar_passe', 'desativar_passe', 'progredir_passe']) {
      expect(rpcs, funcao).toMatch(
        new RegExp(
          `revoke execute on function public\\.${funcao}[\\s\\S]{0,160}?from public, anon, authenticated`,
          'i',
        ),
      )
    }
    // O progresso entra pela mesma rota que já credita XP e moeda.
    const inicio = sqlExecutavel.lastIndexOf('create or replace function public.creditar_ciclos(')
    const corpo = sqlExecutavel.slice(inicio, sqlExecutavel.indexOf('$$;', inicio))
    expect(corpo).toContain('public.progredir_passe(p_player_id, p_ciclos::bigint)')
  })

  it('nenhuma RPC aprendeu a receber modo, abate ou desempenho', () => {
    // Critério 4 de `specs/mundo-aberto-e-modo-manual.md`, e a razão de a
    // inversão de premissa não ter custado nada em segurança: o jogo virou
    // manual, mas o servidor continua creditando por tempo × poder e não sabe
    // quem estava no comando.
    //
    // No dia em que uma RPC receber "quantos você matou", manual passa a valer
    // mais que auto e a regra central do produto cai. É esse dia que este teste
    // adia.
    const proibidos = /\bp_(modo|manual|auto|abates?|mortes?|kills?|acertos?|desempenho|pontuacao|score)\b/i
    const definicoes = [
      ...sqlExecutavel.matchAll(/create or replace function public\.(\w+)\(([\s\S]*?)\)\s*returns/gi),
    ]
    expect(definicoes.length).toBeGreaterThan(0)

    for (const [, nome, assinatura] of definicoes) {
      expect(assinatura, `${nome} não pode receber sinal de desempenho`).not.toMatch(proibidos)
    }

    // E `validar_lote`, que é por onde o crédito ao vivo passa, continua sem
    // parâmetro nenhum — coberto acima, reafirmado aqui por ser o caminho que
    // a mudança de premissa mais pressionou.
    expect(sqlExecutavel).toMatch(/create or replace function public\.validar_lote\(\)/)
  })

  it('EXECUTE não é mais concedido por omissão', () => {
    // A lição que custou um furo real (migration 20260823): o Postgres concede
    // EXECUTE a PUBLIC em toda função nova. Enquanto o schema dependia de
    // alguém lembrar de revogar, `sorteio01` ficou alcançável pelo jogador —
    // e este arquivo não pegou, porque auditava os revokes que EXISTIAM, nunca
    // os que faltavam.
    //
    // As duas instruções abaixo invertem o padrão. Quem prova o resultado é o
    // teste de fumaça, perguntando ao banco; aqui só se garante que a inversão
    // continua no schema.
    expect(sqlExecutavel).toMatch(
      /alter default privileges in schema public revoke execute on functions from public/i,
    )
    expect(sqlExecutavel).toMatch(
      /revoke execute on all functions in schema public from public, anon, authenticated/i,
    )
  })

  it('o tempero do RNG nunca é concedido a ninguém', () => {
    // É ele que torna a fórmula do sorteio inútil sem o servidor. Um grant
    // aqui devolveria a previsibilidade do loot ao client.
    expect(sqlExecutavel).toMatch(/revoke all on public\.segredo_rng from public, anon, authenticated/i)
    expect(sqlExecutavel).not.toMatch(/grant\s+\w+[^;]*on\s+(table\s+)?public\.segredo_rng/i)
  })

  it('nenhum sorteio do jogo usa random() do Postgres', () => {
    // Todo sorteio sai de `md5(player_id || contador)`: mesma semente, mesmo
    // resultado. É o que torna o loot auditável e impossível de re-rolar — e
    // um `random()` solto numa migration futura desfaria isso em silêncio.
    // `gen_random_uuid()` é outra função e continua valendo para chave primária.
    expect(sqlExecutavel).not.toMatch(/(?<!gen_)random\s*\(\s*\)/i)
    expect(sqlExecutavel).toContain('md5(')
  })

  it('nenhuma tabela guarda dado de cartão', () => {
    // O processamento é 100% do gateway. Uma coluna de cartão no nosso schema
    // mudaria a classificação do produto inteiro para PCI-DSS.
    expect(sqlExecutavel).not.toMatch(/\b(cartao|card_number|numero_cartao|cvv|cvc)\b/i)
  })

  it('as RPCs de LGPD não alcançam a conta de outro jogador', () => {
    // A garantia é a AUSÊNCIA do parâmetro, não uma checagem dentro do corpo:
    // sem `player_id` na assinatura, não existe chamada capaz de exportar ou
    // apagar conta alheia — não há o que esquecer de validar.
    for (const funcao of ['exportar_meus_dados', 'excluir_minha_conta']) {
      expect(rpcs, funcao).toMatch(
        new RegExp(`grant execute on function public\\.${funcao}\\(\\)\\s+to authenticated`, 'i'),
      )

      const inicio = sqlExecutavel.lastIndexOf(`create or replace function public.${funcao}(`)
      expect(inicio, funcao).toBeGreaterThan(-1)
      const corpo = sqlExecutavel.slice(inicio, sqlExecutavel.indexOf('$$;', inicio))

      // Só `auth.uid()` decide de quem é o dado.
      expect(corpo, `${funcao} precisa usar auth.uid()`).toContain('auth.uid()')
      expect(corpo, `${funcao} não pode receber player_id`).not.toMatch(/\bp_player_id\b/)
    }
  })

  it('a referência do gateway nunca é concedida ao jogador', () => {
    // `CLAUDE.md`: nunca `select *` em tabela sensível. `assinatura` é a tabela
    // que a regra nomeia, e `referencia_externa` é o identificador do jogador
    // dentro do gateway de pagamento.
    const grants = [
      ...sqlExecutavel.matchAll(/grant select\s*(\(([^)]*)\))?\s*\n?\s*on public\.assinatura/gi),
    ]
    expect(grants.length).toBeGreaterThan(0)

    for (const [, , colunas] of grants) {
      // Grant sem lista de colunas é a tabela inteira — o que a regra proíbe.
      expect(colunas, 'grant de assinatura precisa listar colunas').toBeDefined()
      const lista = colunas!.split(',').map((c) => c.trim())
      expect(lista).not.toContain('referencia_externa')
      expect(lista).not.toContain('provedor')
    }
  })

  it('a data de nascimento não pode ser reescrita depois de informada', () => {
    // Sem isto o jogador teria UPDATE na própria coluna e o gate de idade
    // viraria uma formalidade reversível a qualquer momento.
    expect(fundacao).toContain('DATA_NASCIMENTO_IMUTAVEL')
    expect(fundacao).toMatch(/old\.data_nascimento is not null/i)
  })
})
