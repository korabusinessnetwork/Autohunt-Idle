-- ============================================================================
-- Stub mínimo do Supabase, para aplicar e testar as migrations num Postgres
-- comum — local ou em CI.
--
-- Reproduz só o que o schema do jogo realmente usa:
--   · o schema `auth` com a tabela `users` (colunas `email` e `email_change`,
--     que `identidade_verificada` e `montar_snapshot` consultam);
--   · `auth.uid()`, lendo de uma variável de sessão que o teste define;
--   · os três papéis do Supabase (`anon`, `authenticated`, `service_role`),
--     que os GRANTs e REVOKEs das migrations referenciam.
--
-- NÃO é o Supabase: RLS aqui não é exercitada por um JWT de verdade, e o
-- comportamento de `auth` real pode divergir. Serve para provar que o SQL
-- roda, que as constraints valem e que a matemática do jogo fecha — que é
-- exatamente o que a auditoria por leitura de arquivo não consegue provar.
-- ============================================================================

create schema if not exists auth;

create table if not exists auth.users (
  id           uuid primary key,
  email        text,
  email_change text default '',
  criado_em    timestamptz not null default now()
);

/**
 * Jogador da sessão corrente.
 *
 * No Supabase isto sai do JWT; aqui sai de uma variável de sessão que o teste
 * define com `set local autohunt.uid = '...'`.
 */
create or replace function auth.uid()
returns uuid
language plpgsql
stable
as $$
begin
  return nullif(current_setting('autohunt.uid', true), '')::uuid;
exception
  when others then return null;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- AS DEFAULT PRIVILEGES DO SUPABASE — o pedaço que faltava, e que custou caro
--
-- Um projeto Supabase de verdade nasce com isto configurado: TODO objeto novo
-- no schema `public` já sai concedido a `anon`, `authenticated` e
-- `service_role`. É o oposto do Postgres puro, onde tabela nova nasce fechada.
--
-- Sem esta linha aqui, o Postgres local mentia por omissão: uma migration que
-- esquecesse o `revoke all on public.<tabela> from anon, authenticated` passava
-- verde aqui e vazava lá. Foi exatamente o que aconteceu com `public.ajuste` e
-- com `emitir_ticket_auto()` — descobertos rodando `scripts/conferir-supabase.sql`
-- contra o projeto real, em 2026-08-12, e invisíveis para toda a suíte local.
--
-- É a mesma lição da migration 20260823, agora aprendida do outro lado: o texto
-- da migration prova o que ela DIZ; só um banco fiel prova o que ela DEIXOU.
-- Um stub que simula o Supabase pela metade é um stub que aprova o que o
-- Supabase reprova.
-- ---------------------------------------------------------------------------
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
