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
