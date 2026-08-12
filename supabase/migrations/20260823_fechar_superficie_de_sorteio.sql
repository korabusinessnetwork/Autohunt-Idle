-- ============================================================================
-- Autohunt Idle — fecha a superfície de sorteio.
--
-- CORREÇÃO DE SEGURANÇA. O modelo de ameaças afirmava, na ameaça 5.2, que o
-- sorteio determinístico tornava o loot "impossível de re-rolar". A afirmação
-- estava ERRADA, e a auditoria da superfície de RPC (rodada 11) mostrou por quê:
--
--   1. `sorteio01(text)` estava alcançável por `authenticated`. Não por um
--      GRANT explícito — por AUSÊNCIA de revoke: o Postgres concede EXECUTE a
--      PUBLIC em toda função nova, por padrão. As migrations revogavam só as
--      funções que alguém lembrou de revogar.
--   2. `farm_state.contador_sorteio` estava legível pelo client, porque o
--      GRANT era da tabela inteira.
--
-- Com as duas coisas, a semente era inteiramente conhecida
-- (`player_id || marcador || contador`) e o resultado, calculável de antemão.
-- E daí sai o exploit de verdade: sabendo que o próximo sorteio é ruim, o
-- jogador QUEIMA o contador numa ação barata (uma síntese) e guarda a ação
-- valiosa (a dungeon) para quando o número for bom. Re-rolagem, com outro nome.
--
-- Esta migration fecha em três frentes, e nenhuma delas sozinha bastaria:
--   A. um segredo do servidor entra na semente — sem ele, saber a fórmula e o
--      contador não basta;
--   B. EXECUTE é revogado de PUBLIC em bloco, e a superfície do client volta a
--      ser uma lista explícita — o que estava implícito passa a ser declarado;
--   C. `contador_sorteio` sai do GRANT do client.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. O segredo que entra em toda semente
--
-- Uma linha, uma tabela, sem GRANT nenhum e com RLS ligada. Só função
-- SECURITY DEFINER a alcança — ela roda como dona do schema e passa por cima
-- da RLS, que é exatamente o que se quer aqui.
--
-- Repare que o jogador pode até conhecer o algoritmo (ele está neste
-- repositório) e o próprio contador: sem o segredo, nada disso permite prever
-- o resultado.
-- ---------------------------------------------------------------------------
create table if not exists public.segredo_rng (
  unico  boolean primary key default true check (unico),
  valor  text not null
);

insert into public.segredo_rng (unico, valor)
values (true, gen_random_uuid()::text || gen_random_uuid()::text)
on conflict (unico) do nothing;

comment on table public.segredo_rng is
  'Tempero do RNG. Nunca concedida a ninguém — só funções SECURITY DEFINER a leem. Trocar o valor re-embaralha todo sorteio futuro.';

alter table public.segredo_rng enable row level security;
-- Sem policy, de propósito: ninguém que passe pela RLS pode ler.
revoke all on public.segredo_rng from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- `sorteio01` passa a temperar a semente.
--
-- Uma função só muda, e os 20+ pontos de sorteio do jogo herdam a correção —
-- é por isso que o RNG ter um ponto de entrada único valeu a pena.
--
-- Deixa de ser `immutable` (lê tabela) e vira `stable`: continua determinística
-- dentro de uma transação, que é o que o jogo precisa. Nenhum índice depende
-- dela.
-- ---------------------------------------------------------------------------
create or replace function public.sorteio01(p_semente text)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (('x' || substr(md5((select valor from public.segredo_rng) || p_semente), 1, 8))
          ::bit(32)::bigint)::numeric / 4294967296.0;
$$;

-- ---------------------------------------------------------------------------
-- B. EXECUTE deixa de ser concedido por omissão
--
-- O padrão do Postgres é conceder EXECUTE a PUBLIC em toda função nova. Isso
-- transforma "esqueci de revogar" em "está exposto", que foi exatamente o que
-- aconteceu. As duas instruções abaixo invertem o padrão: nada é alcançável a
-- menos que esteja na lista explícita mais adiante.
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke execute on functions from public;
revoke execute on all functions in schema public from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A superfície do jogador, agora declarada de uma vez só.
--
-- Esta lista É o contrato do client (`docs/07_APIS/`). Nada fora dela é
-- alcançável, e um teste confere que a lista viva no banco é exatamente esta.
-- ---------------------------------------------------------------------------
grant execute on function public.iniciar_sessao()            to authenticated;
grant execute on function public.validar_lote()              to authenticated;
grant execute on function public.encerrar_sessao()           to authenticated;
grant execute on function public.coletar_farm_offline()      to authenticated;
grant execute on function public.emitir_ticket_anuncio()     to authenticated;
grant execute on function public.estado_jogador()            to authenticated;

grant execute on function public.redistribuir_atributos(integer, integer, integer, integer)
  to authenticated;
grant execute on function public.reativar_auto_alocacao()    to authenticated;

grant execute on function public.definir_apelido(text)       to authenticated;
grant execute on function public.ranking_global()            to authenticated;

grant execute on function public.iniciar_dungeon()           to authenticated;
grant execute on function public.sintetizar(text, smallint)  to authenticated;
grant execute on function public.equipar_item(uuid)          to authenticated;
grant execute on function public.fortificar_item(uuid, boolean, boolean) to authenticated;

grant execute on function public.comprar_ouro(text)          to authenticated;

grant execute on function public.exportar_meus_dados()       to authenticated;
grant execute on function public.excluir_minha_conta()       to authenticated;

-- E a superfície do servidor, pelo mesmo motivo: o revoke em bloco derrubou
-- também os GRANTs de `service_role`.
grant execute on function public.creditar_anuncio(uuid)      to service_role;
grant execute on function public.resgatar_anuncio_do_jogador(uuid, uuid) to service_role;
grant execute on function public.aplicar_evento_assinatura(uuid, text, timestamptz, text, text)
  to service_role;
grant execute on function public.creditar_diamante(uuid, integer, text) to service_role;
grant execute on function public.ativar_passe(uuid, text)    to service_role;
grant execute on function public.desativar_passe(uuid)       to service_role;
grant execute on function public.recomputar_ranking()        to service_role;

-- ---------------------------------------------------------------------------
-- C. O contador de sorteio sai da vista do client
--
-- Ele é metade da semente. Mesmo com o tempero, publicá-lo é dar de graça a
-- única parte que o servidor controlava — e o client nunca precisou dele: o
-- snapshot já entrega tudo pronto.
-- ---------------------------------------------------------------------------
revoke select on public.farm_state from authenticated;
grant select (player_id, last_seen_at, minutos_acumulados, xp_pendente, moeda_pendente,
              minutos_anuncio_saldo, minutos_anuncio_creditados, janela_anuncio_iniciada_em,
              ultimo_motivo)
  on public.farm_state to authenticated;

comment on column public.farm_state.contador_sorteio is
  'Metade da semente de todo sorteio. NUNCA concedida ao client — publicá-la reabre a re-rolagem por queima de contador.';
