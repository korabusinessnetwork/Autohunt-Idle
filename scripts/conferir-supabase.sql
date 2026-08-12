-- ============================================================================
-- Conferência do projeto Supabase — SOMENTE LEITURA.
--
-- Cole no SQL Editor e rode. Não escreve nada, não cria conta de teste, não
-- deixa rastro. Devolve uma linha por verificação, com as falhas no topo.
--
-- POR QUE ISTO EXISTE, e não é redundante com `scripts/pg-local.sh`: aquele
-- prova que as migrations APLICAM. Este pergunta ao banco que de fato serve o
-- jogo o que ele DEIXOU — que é outra coisa. A diferença já custou um furo de
-- segurança real (migration 20260823): `sorteio01` estava alcançável pelo
-- jogador, não por um GRANT, mas por um revoke que faltava. Auditar o texto das
-- migrations não pegava; perguntar ao banco pegou.
--
-- Rode depois de aplicar o schema, e de novo depois de qualquer migration nova.
-- ============================================================================

with verificacoes as (

  -- ---- Estrutura -----------------------------------------------------------
  select 1 as ordem, 'as 13 tabelas existem' as verificacao,
         (select count(*) from pg_tables where schemaname = 'public') = 13 as ok,
         (select count(*)::text from pg_tables where schemaname = 'public') as detalhe

  union all
  select 2, 'RLS ligada em toda tabela',
         not exists (
           select 1 from pg_tables t
             join pg_class c on c.relname = t.tablename and c.relnamespace = 'public'::regnamespace
            where t.schemaname = 'public' and not c.relrowsecurity),
         coalesce((select string_agg(t.tablename, ', ')
                     from pg_tables t
                     join pg_class c on c.relname = t.tablename
                                    and c.relnamespace = 'public'::regnamespace
                    where t.schemaname = 'public' and not c.relrowsecurity), 'todas ok')

  -- ---- A superfície do jogador é exatamente a declarada ---------------------
  union all
  select 3, 'o jogador alcança exatamente as 21 RPCs do contrato',
         (select array_agg(p.proname order by p.proname)
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and has_function_privilege('authenticated', p.oid, 'execute'))
         = array[
           'coletar_farm_offline', 'comprar_ouro', 'definir_ajuste', 'definir_apelido',
           'e_admin', 'emitir_ticket_anuncio', 'emitir_ticket_auto', 'encerrar_sessao',
           'equipar_item', 'estado_jogador', 'excluir_minha_conta', 'exportar_meus_dados',
           'fortificar_item', 'iniciar_dungeon', 'iniciar_sessao', 'log_operacional',
           'ranking_global', 'reativar_auto_alocacao', 'redistribuir_atributos',
           'sintetizar', 'validar_lote'
         ]::name[],
         coalesce((select string_agg(p.proname, ', ' order by p.proname)
                     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public'
                      and has_function_privilege('authenticated', p.oid, 'execute')
                      and p.proname not in (
                        'coletar_farm_offline', 'comprar_ouro', 'definir_ajuste', 'definir_apelido',
                        'e_admin', 'emitir_ticket_anuncio', 'emitir_ticket_auto', 'encerrar_sessao',
                        'equipar_item', 'estado_jogador', 'excluir_minha_conta', 'exportar_meus_dados',
                        'fortificar_item', 'iniciar_dungeon', 'iniciar_sessao', 'log_operacional',
                        'ranking_global', 'reativar_auto_alocacao', 'redistribuir_atributos',
                        'sintetizar', 'validar_lote')), 'nenhuma a mais')

  -- ---- O furo de 2026-08-11, fechado -------------------------------------
  union all
  select 4, 'o sorteio é inalcançável pelo jogador',
         not has_function_privilege('authenticated', 'public.sorteio01(text)', 'execute')
         and not has_function_privilege('authenticated',
               'public.conceder_item(uuid, text, smallint, smallint, text, integer)', 'execute'),
         'sorteio01 e conceder_item'

  union all
  select 5, 'o tempero do RNG não é legível por ninguém',
         not has_table_privilege('authenticated', 'public.segredo_rng', 'SELECT')
         and not has_table_privilege('anon', 'public.segredo_rng', 'SELECT'),
         'segredo_rng'

  union all
  select 6, 'o contador de sorteio saiu da vista do client',
         not has_column_privilege('authenticated', 'public.farm_state', 'contador_sorteio', 'SELECT'),
         'farm_state.contador_sorteio'

  union all
  select 7, 'EXECUTE não é concedido por omissão',
         (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and has_function_privilege('authenticated', p.oid, 'execute')) = 21,
         'só as 21 do contrato'

  -- ---- Progressão e admin não são escritos pelo jogador --------------------
  union all
  select 8, 'o jogador não escreve progressão nem admin',
         not has_column_privilege('authenticated', 'public.jogador', 'nivel',     'UPDATE')
         and not has_column_privilege('authenticated', 'public.jogador', 'moeda',    'UPDATE')
         and not has_column_privilege('authenticated', 'public.jogador', 'diamante', 'UPDATE')
         and not has_column_privilege('authenticated', 'public.jogador', 'admin',    'UPDATE'),
         'nivel, moeda, diamante, admin'

  union all
  select 9, 'ninguém escreve na tabela de ajuste pelo client',
         not has_table_privilege('authenticated', 'public.ajuste', 'UPDATE')
         and not has_table_privilege('authenticated', 'public.ajuste', 'INSERT')
         and not has_table_privilege('authenticated', 'public.ajuste', 'DELETE'),
         'só definir_ajuste escreve'

  -- ---- Catálogos semeados --------------------------------------------------
  union all
  select 10, 'o catálogo de balanceamento foi semeado',
         (select count(*) from public.ajuste) = 16,
         (select count(*)::text || ' ajustes' from public.ajuste)

  union all
  select 11, 'a trilha do passe e a loja de ouro existem',
         (select count(*) from public.passe_recompensa) > 0
         and (select count(*) from public.pacote_ouro) > 0,
         (select (select count(*) from public.passe_recompensa)::text || ' tiers, '
               || (select count(*) from public.pacote_ouro)::text || ' pacotes')

  union all
  select 12, 'o tempero do RNG foi gerado',
         (select count(*) from public.segredo_rng) = 1,
         'uma linha, inalcançável'

  -- ---- O papel anônimo não alcança nada ------------------------------------
  union all
  select 13, 'quem não autenticou não alcança nada',
         not exists (
           select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')),
         'anon sem função nenhuma'

  -- ---- Quem é admin --------------------------------------------------------
  union all
  select 14, 'a lista de admins é só quem você reconhece',
         true,  -- informativo: só você sabe se está certa
         coalesce((select string_agg(coalesce(apelido, left(id::text, 8)), ', ')
                     from public.jogador where admin), 'ninguém ainda — passo 7')
)

select case when ok then '✅' else '❌ FALHOU' end as status,
       verificacao,
       detalhe
  from verificacoes
 order by ok, ordem;
