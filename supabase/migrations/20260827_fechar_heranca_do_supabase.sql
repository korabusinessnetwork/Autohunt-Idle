-- ============================================================================
-- Autohunt Idle — fechar o que o Supabase abre por padrão.
--
-- ACHADO EM 2026-08-12, rodando `scripts/conferir-supabase.sql` contra o
-- projeto REAL, na primeira vez que este schema existiu fora de um Postgres de
-- teste. Duas falhas que a suíte local aprovava:
--
--   1. `public.ajuste` com **ALL** para `anon` e `authenticated`;
--   2. `emitir_ticket_auto()` com **EXECUTE** para `anon`.
--
-- A CAUSA, e ela é a mesma nas duas: um projeto Supabase nasce com
-- `alter default privileges in schema public grant all ... to anon,
-- authenticated, service_role`. **Objeto novo já nasce concedido** — o oposto
-- do Postgres puro. Toda migration anterior sabia disso e fazia
-- `revoke all on public.<tabela> from anon, authenticated` logo depois de
-- criar; a de 20260825 esqueceu, e a de 20260824 revogou `emitir_ticket_auto`
-- só `from public`, não de `anon`.
--
-- POR QUE NENHUM TESTE PEGOU: `scripts/stub-supabase.sql` criava os três papéis
-- mas **não reproduzia as default privileges**. Sem elas, o revoke esquecido
-- era um no-op invisível — o local aprovava o que o Supabase reprovava. O stub
-- foi corrigido junto com esta migration, e o teste de fumaça agora falha antes
-- dela e passa depois.
--
-- QUAL ERA O RISCO REAL: baixo, e vale ser exato em vez de dramático. A RLS
-- segurava: `ajuste` tem policy só de `select`, então sem policy de escrita
-- nenhum UPDATE/INSERT/DELETE passava, mesmo com o grant. E
-- `emitir_ticket_auto()` levanta `NAO_AUTENTICADO` quando `auth.uid()` é nulo,
-- que é sempre o caso do `anon`. **Mas a defesa era uma camada, não duas** — e
-- o desenho inteiro do console se apoia em "não existe grant de escrita para o
-- client". Uma camada que existe só no papel não é camada.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. As duas brechas concretas
-- ---------------------------------------------------------------------------
revoke all on public.ajuste from anon, authenticated;

-- Reconcede exatamente o que o console precisa ler: colunas explícitas, e
-- nenhuma escrita. `atualizado_por` continua de fora — é uuid de jogador, e
-- quem precisa dele é o log, que passa por RPC.
grant select (chave, valor, minimo, maximo, escopo, categoria, descricao, atualizado_em)
  on public.ajuste to authenticated;

revoke execute on function public.emitir_ticket_auto() from anon;

-- ---------------------------------------------------------------------------
-- 2. A inversão — para a próxima migration não depender de memória
--
-- A 20260823 já tinha feito isto para funções, mas só `from public`. O papel
-- `anon` do Supabase é um papel nomeado, e `revoke from public` não o alcança.
-- Aqui a inversão fica completa: objeto novo no schema `public` nasce fechado
-- para os dois papéis do client, e quem quiser abrir abre explicitamente.
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Varredura do que já existe
--
-- A inversão acima só vale para objetos FUTUROS. Estes revokes fecham o que já
-- está no banco — e são inofensivos onde a migration de origem já tinha
-- revogado, que é o caso de 12 das 13 tabelas.
--
-- Depois de revogar tudo, cada grant do contrato é reconcedido. A lista abaixo
-- é a superfície de tabela do client, por extenso: se ela divergir do que o
-- jogo precisa, o teste de fumaça reprova.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- jogador: lê a própria linha inteira; escreve só o que é dele decidir.
grant select on public.jogador to authenticated;
grant insert (id, data_nascimento, idioma) on public.jogador to authenticated;
grant update (data_nascimento, idioma)     on public.jogador to authenticated;

-- farm_state: sem `contador_sorteio`, que é metade da semente de todo sorteio.
grant select (player_id, last_seen_at, minutos_acumulados, xp_pendente, moeda_pendente,
              minutos_anuncio_saldo, minutos_anuncio_creditados, janela_anuncio_iniciada_em,
              minutos_auto_saldo, minutos_auto_creditados, janela_auto_iniciada_em,
              ultimo_motivo)
  on public.farm_state to authenticated;

grant select on public.ticket_anuncio to authenticated;

-- assinatura: sem `referencia_externa` nem `provedor` — são a identidade do
-- jogador dentro do gateway.
grant select (player_id, status, expira_em, atualizada_em)
  on public.assinatura to authenticated;

-- evento_jogo: a única tabela em que o client insere. Dívida D10, registrada.
grant select                          on public.evento_jogo to authenticated;
grant insert (player_id, tipo, dados) on public.evento_jogo to authenticated;

grant select on public.atributo_jogador to authenticated;
grant select on public.item_jogador     to authenticated;

-- ranking_posicao: **sem `player_id`**. O placar mostra apelido, nível e
-- posição — quem aparece ali escolheu aparecer, e só com o nome que escolheu.
grant select (posicao, apelido, nivel, atualizado_em)
  on public.ranking_posicao to authenticated;

-- Catálogos: preço e recompensa precisam estar na tela ANTES da compra. É o que
-- separa a loja de ouro e o passe de uma caixa de recompensa aleatória.
grant select on public.pacote_ouro      to authenticated;
grant select on public.passe_recompensa to authenticated;

-- `passe_jogador` por coluna, e **sem `referencia_externa`**: é o identificador
-- do jogador dentro do gateway, mesma razão de ele estar fora do grant de
-- `assinatura`. Reconceder a tabela inteira aqui teria aberto uma coluna que a
-- migration de origem fechou — corrigir um vazamento abrindo outro.
grant select (player_id, ativo, pontos, tier, ativado_em)
  on public.passe_jogador to authenticated;

grant select (chave, valor, minimo, maximo, escopo, categoria, descricao, atualizado_em)
  on public.ajuste to authenticated;

-- `segredo_rng` não aparece nesta lista, e a ausência é o ponto: RLS ligada,
-- nenhuma policy, nenhum grant. Ninguém passa.
