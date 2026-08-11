-- ============================================================================
-- Autohunt Idle — fundação do schema: jogador, estado de farm, assinatura,
-- ticket de anúncio e log de eventos.
--
-- Regras que este arquivo materializa:
--   · ADR-002 — isolamento por `player_id`/`user_id`. NÃO existe `tenant_id`.
--   · CLAUDE.md — RLS ativa em toda tabela, sem exceção nem "temporariamente".
--   · memory/restrictions.md (CRÍTICA) — 18+ com enforcement no banco, não só
--     no formulário.
--
-- Princípio geral de escrita: o client NUNCA escreve progressão. As colunas de
-- XP/moeda/nível/minutos só mudam por RPC `SECURITY DEFINER` (migration
-- 20260811_rpc_farm_e_sessao.sql). Isso é garantido por GRANT de coluna, não
-- por confiança na aplicação.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- jogador — perfil e progressão
-- ---------------------------------------------------------------------------
create table if not exists public.jogador (
  id                uuid primary key references auth.users (id) on delete cascade,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),

  -- Null enquanto a conta é anônima. Vira obrigatória no cadastro (core, 18).
  data_nascimento   date,

  idioma            text    not null default 'pt' check (idioma in ('pt', 'en')),

  -- Progressão. Sem teto de nível (core, 12) — daí `bigint`, e nenhuma
  -- constante de nível máximo existe em lugar nenhum do projeto.
  nivel             bigint  not null default 1     check (nivel >= 1),
  xp_total          bigint  not null default 0     check (xp_total >= 0),
  moeda             bigint  not null default 0     check (moeda >= 0),

  -- Vitalidade do ciclo de farm em andamento (core, 16). Zerar aqui só custa
  -- o ciclo corrente; nada já creditado é retirado.
  vitalidade_atual  integer not null default 100   check (vitalidade_atual >= 0)
);

comment on table  public.jogador is
  'Perfil e progressão do jogador. Single-tenant: isolamento por id = auth.uid() (ADR-002).';
comment on column public.jogador.data_nascimento is
  'Data de nascimento real exigida no cadastro. <18 anos é bloqueado por trigger (ECA Digital, Lei 15.211/2025).';
comment on column public.jogador.vitalidade_atual is
  'Vitalidade do ciclo de farm corrente. Zerar perde só o ciclo em andamento — nunca o progresso já creditado.';

-- ---------------------------------------------------------------------------
-- farm_state — estado temporal do farm (1:1 com jogador)
-- ---------------------------------------------------------------------------
create table if not exists public.farm_state (
  player_id                    uuid primary key
                                 references public.jogador (id) on delete cascade,

  -- Marco temporal autoritativo. Só avança dentro das RPCs, sempre com `now()`
  -- do Postgres e sempre na mesma instrução que credita (evita crédito duplo
  -- em reconexão rápida — edge case do core).
  last_seen_at                 timestamptz not null default now(),

  -- Farm offline já resolvido e ainda NÃO coletado. É este bolo que é zerado
  -- quando a assinatura vence de fato (core, 9).
  minutos_acumulados           integer not null default 0 check (minutos_acumulados >= 0),
  xp_pendente                  bigint  not null default 0 check (xp_pendente  >= 0),
  moeda_pendente               bigint  not null default 0 check (moeda_pendente >= 0),

  -- Anúncio recompensado (core, 6 e 8). `saldo` é o que ainda dá pra gastar em
  -- farm offline; `creditados_na_janela` é o que já foi liberado na janela de
  -- 24h corrente. Ambos limitados ao teto diário de 120 min.
  minutos_anuncio_saldo        integer not null default 0
                                 check (minutos_anuncio_saldo between 0 and 120),
  minutos_anuncio_creditados   integer not null default 0
                                 check (minutos_anuncio_creditados between 0 and 120),
  janela_anuncio_iniciada_em   timestamptz not null default now(),

  -- Motivo do último resultado de retorno, para a tela explicar sem o client
  -- precisar deduzir nada (core, 10).
  ultimo_motivo                text not null default 'primeira_sessao'
                                 check (ultimo_motivo in (
                                   'primeira_sessao',
                                   'creditado',
                                   'teto_assinante',
                                   'teto_anuncio',
                                   'sem_desbloqueio',
                                   'assinatura_vencida'
                                 ))
);

comment on table public.farm_state is
  'Estado temporal do farm. Escrito exclusivamente por RPC SECURITY DEFINER — o client só lê.';
comment on column public.farm_state.last_seen_at is
  'Última vez que o servidor creditou o jogador. Parar de avançar É o fim da sessão ao vivo: não depende de o beacon do navegador chegar.';

-- ---------------------------------------------------------------------------
-- assinatura — estado do plano do jogador
-- ---------------------------------------------------------------------------
create table if not exists public.assinatura (
  player_id           uuid primary key
                        references public.jogador (id) on delete cascade,

  -- 'cancelada' = jogador pediu cancelamento mas o período pago ainda corre:
  -- o benefício continua até `expira_em` (core, 9 — vencer ≠ clicar cancelar).
  status              text not null default 'inexistente'
                        check (status in ('inexistente', 'ativa', 'cancelada', 'vencida')),
  expira_em           timestamptz,

  provedor            text check (provedor in ('stripe', 'asaas')),
  referencia_externa  text,
  atualizada_em       timestamptz not null default now(),

  -- Sem período pago não existe assinatura valendo.
  constraint assinatura_ativa_tem_prazo
    check (status = 'inexistente' or expira_em is not null)
);

comment on table public.assinatura is
  'Estado de assinatura por jogador. Escrita só por webhook do gateway (service_role) — nunca pelo client.';

-- ---------------------------------------------------------------------------
-- ticket_anuncio — resgate de anúncio recompensado, uso único
-- ---------------------------------------------------------------------------
create table if not exists public.ticket_anuncio (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.jogador (id) on delete cascade,
  criado_em     timestamptz not null default now(),
  expira_em     timestamptz not null default now() + interval '30 minutes',

  -- Null = ainda não resgatado. O crédito só acontece na transição para
  -- não-null, e essa transição é feita uma vez só (core, 7 + edge case do
  -- anúncio interrompido).
  resgatado_em  timestamptz,
  minutos       integer not null default 15 check (minutos > 0)
);

create index if not exists ticket_anuncio_player_idx
  on public.ticket_anuncio (player_id, criado_em desc);

comment on table public.ticket_anuncio is
  'Ticket de anúncio recompensado. Emitido pelo servidor, resgatável uma única vez pelo callback assinado do provedor.';

-- ---------------------------------------------------------------------------
-- evento_jogo — log de atividade (fire-and-forget, nunca bloqueia o jogo)
-- ---------------------------------------------------------------------------
create table if not exists public.evento_jogo (
  id         bigint generated always as identity primary key,
  player_id  uuid not null references public.jogador (id) on delete cascade,
  tipo       text not null,          -- dot.case no passado: farm.calculado, anuncio.creditado
  dados      jsonb not null default '{}'::jsonb,
  criado_em  timestamptz not null default now()
);

create index if not exists evento_jogo_player_idx
  on public.evento_jogo (player_id, criado_em desc);

-- ============================================================================
-- Gate de idade — enforcement no banco (memory/restrictions.md, CRÍTICA)
--
-- Não dá pra usar CHECK: `current_date` não é imutável. Trigger é o único
-- lugar onde a regra vale mesmo se alguém escrever direto no banco.
-- ============================================================================
create or replace function public.validar_idade_minima()
returns trigger
language plpgsql
as $$
begin
  -- Data de nascimento é imutável depois de informada. Sem isto, o jogador
  -- teria UPDATE na própria coluna e poderia reescrevê-la à vontade — o gate
  -- viraria uma formalidade de um clique só.
  if tg_op = 'UPDATE'
     and old.data_nascimento is not null
     and new.data_nascimento is distinct from old.data_nascimento then
    raise exception 'DATA_NASCIMENTO_IMUTAVEL'
      using hint = 'A data de nascimento não pode ser alterada depois de informada.';
  end if;

  if new.data_nascimento is not null then
    if new.data_nascimento > current_date then
      raise exception 'DATA_NASCIMENTO_INVALIDA'
        using hint = 'Data de nascimento no futuro.';
    end if;

    if new.data_nascimento > (current_date - interval '18 years') then
      raise exception 'IDADE_MINIMA_NAO_ATINGIDA'
        using hint = 'Autohunt Idle é restrito a maiores de 18 anos.';
    end if;
  end if;

  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists jogador_valida_idade on public.jogador;
create trigger jogador_valida_idade
  before insert or update on public.jogador
  for each row execute function public.validar_idade_minima();

-- ============================================================================
-- RLS — toda tabela, sem exceção. Isolamento por auth.uid() (ADR-002).
-- ============================================================================
alter table public.jogador         enable row level security;
alter table public.farm_state      enable row level security;
alter table public.assinatura      enable row level security;
alter table public.ticket_anuncio  enable row level security;
alter table public.evento_jogo     enable row level security;

-- jogador: lê e cria a própria linha; atualiza só as colunas que são dele
-- (o recorte de coluna vem do GRANT abaixo — RLS sozinha não filtra coluna).
drop policy if exists jogador_le_proprio on public.jogador;
create policy jogador_le_proprio on public.jogador
  for select using (auth.uid() = id);

drop policy if exists jogador_cria_proprio on public.jogador;
create policy jogador_cria_proprio on public.jogador
  for insert with check (auth.uid() = id);

drop policy if exists jogador_atualiza_proprio on public.jogador;
create policy jogador_atualiza_proprio on public.jogador
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- farm_state: leitura apenas. Escrita é exclusividade das RPCs SECURITY DEFINER.
drop policy if exists farm_state_le_proprio on public.farm_state;
create policy farm_state_le_proprio on public.farm_state
  for select using (auth.uid() = player_id);

-- assinatura: leitura apenas. Escrita é exclusividade do webhook (service_role).
drop policy if exists assinatura_le_propria on public.assinatura;
create policy assinatura_le_propria on public.assinatura
  for select using (auth.uid() = player_id);

-- ticket_anuncio: leitura apenas. Emissão e resgate são do servidor.
drop policy if exists ticket_le_proprio on public.ticket_anuncio;
create policy ticket_le_proprio on public.ticket_anuncio
  for select using (auth.uid() = player_id);

-- evento_jogo: o jogador registra e lê os próprios eventos.
drop policy if exists evento_le_proprio on public.evento_jogo;
create policy evento_le_proprio on public.evento_jogo
  for select using (auth.uid() = player_id);

drop policy if exists evento_cria_proprio on public.evento_jogo;
create policy evento_cria_proprio on public.evento_jogo
  for insert with check (auth.uid() = player_id);

-- ============================================================================
-- GRANTs — o recorte que RLS não faz.
--
-- O jogador autenticado pode mudar idioma e informar a data de nascimento.
-- Ele NÃO pode tocar em nivel, xp_total, moeda ou vitalidade — nem com um
-- update legítimo na própria linha.
-- ============================================================================
revoke all on public.jogador        from anon, authenticated;
revoke all on public.farm_state     from anon, authenticated;
revoke all on public.assinatura     from anon, authenticated;
revoke all on public.ticket_anuncio from anon, authenticated;
revoke all on public.evento_jogo    from anon, authenticated;

grant select on public.jogador to authenticated;
grant insert (id, data_nascimento, idioma) on public.jogador to authenticated;
grant update (data_nascimento, idioma)     on public.jogador to authenticated;

grant select on public.farm_state     to authenticated;
grant select on public.assinatura     to authenticated;
grant select on public.ticket_anuncio to authenticated;

grant select                     on public.evento_jogo to authenticated;
grant insert (player_id, tipo, dados) on public.evento_jogo to authenticated;
