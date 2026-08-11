-- ============================================================================
-- Autohunt Idle — atributos de personagem e ranking global.
--
-- Implementa `specs/ranking-global.md` (ver `specs/build-fase-3a-atributos-ranking.md`).
--
-- Regra de custo (critério 11 da spec de origem): subir um atributo do nível
-- `a` para `a+1` custa `1 + floor(a / 10)`. A prosa da spec dizia "níveis 10-19
-- custam 2" e a fórmula dizia outra coisa; o critério 12 desempata com um
-- exemplo — "subir de 10 pra 11 custou 2 pontos" — e é a fórmula que vale.
--
-- Espelhado em `src/game/regrasAtributos.ts`, que tem os testes da regra.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Apelido de exibição.
--
-- Nasce nulo e continua nulo até o jogador abrir o ranking e escolher um. Isso
-- é deliberado: o critério 4 da spec de origem pede apelido "no primeiro
-- acesso", o que colidiria com o critério 17 do core ("abre direto no mundo,
-- sem escolha inicial") e com o Princípio nº1. A própria spec de origem
-- resolve a contradição nos edge cases ("jogador que ainda não definiu nickname
-- não aparece no ranking até definir").
--
-- Efeito colateral bom: não ter apelido É o opt-out do placar público, e
-- defini-lo é o opt-in explícito.
-- ---------------------------------------------------------------------------
alter table public.jogador add column if not exists apelido text;

comment on column public.jogador.apelido is
  'Nome de exibição no ranking. Nulo = jogador não aparece no placar (opt-in por definição).';

-- Apelido não é escrito direto pelo client: passa pela RPC que valida.
revoke update (apelido) on public.jogador from anon, authenticated;

-- ---------------------------------------------------------------------------
-- atributo_jogador — Força, Inteligência, Vitalidade e Sorte
-- ---------------------------------------------------------------------------
create table if not exists public.atributo_jogador (
  player_id      uuid primary key references public.jogador (id) on delete cascade,

  forca          integer not null default 0 check (forca >= 0),
  inteligencia   integer not null default 0 check (inteligencia >= 0),
  vitalidade     integer not null default 0 check (vitalidade >= 0),
  -- Sorte é gravada e alocável desde já, mas ainda NÃO tem efeito: o
  -- consumidor dela é a chance de raridade no drop, que só existe com
  -- `specs/dungeons-loot-skins.md`. Está declarado, não é esquecimento.
  sorte          integer not null default 0 check (sorte >= 0),

  -- Enquanto verdadeiro, o servidor distribui os pontos novos sozinho
  -- (critério 9 da spec de origem, e o Princípio nº1). Vira falso assim que o
  -- jogador redistribui à mão: sem isso, a auto-alocação desfaria a escolha
  -- dele no lote seguinte, 15 segundos depois.
  auto_alocar    boolean not null default true,

  atualizado_em  timestamptz not null default now()
);

comment on table public.atributo_jogador is
  'Alocação de atributos do jogador. Escrita só por RPC SECURITY DEFINER, que confere o custo contra os pontos ganhos.';

-- ---------------------------------------------------------------------------
-- ranking_posicao — placar recomputado periodicamente
--
-- Tabela, não view: o critério 7 da spec de origem exige recomputo periódico,
-- não cálculo a cada leitura. Uma view faria o trabalho toda vez que alguém
-- abrisse o ranking.
-- ---------------------------------------------------------------------------
create table if not exists public.ranking_posicao (
  player_id      uuid primary key references public.jogador (id) on delete cascade,
  apelido        text   not null,
  nivel          bigint not null,
  xp_total       bigint not null,
  posicao        integer not null,
  atualizado_em  timestamptz not null default now()
);

create index if not exists ranking_posicao_ordem_idx on public.ranking_posicao (posicao);

comment on table public.ranking_posicao is
  'Placar público, recomputado periodicamente. Só apelido, nível e posição — nenhum dado pessoal.';

-- Índice que sustenta o recompute e o cálculo de posição ao vivo.
create index if not exists jogador_ranking_idx
  on public.jogador (nivel desc, xp_total desc, criado_em asc)
  where apelido is not null;

-- ============================================================================
-- Matemática do custo de atributo (espelha src/game/regrasAtributos.ts)
-- ============================================================================
create or replace function public.custo_proximo_nivel_atributo(p_atual integer)
returns integer
language sql
immutable
as $$
  select 1 + (p_atual / 10);
$$;

/*
  Custo acumulado de levar um atributo de 0 até `p_nivel`, em forma fechada.

  Somatório de (1 + floor(a/10)) para a de 0 a n-1, que reduz a
  n + 5·q·(q-1) + q·r, com q = n div 10 e r = n mod 10. Fechado em vez de laço
  porque nível não tem teto (core, 12) e isto roda a cada respec.
*/
create or replace function public.custo_acumulado_atributo(p_nivel integer)
returns bigint
language sql
immutable
as $$
  select case
    when p_nivel <= 0 then 0::bigint
    else p_nivel::bigint
         + 5::bigint * (p_nivel / 10) * ((p_nivel / 10) - 1)
         + (p_nivel / 10)::bigint * (p_nivel % 10)
  end;
$$;

/** Pontos que um jogador daquele nível já ganhou na vida (3 por level up). */
create or replace function public.pontos_ganhos_ate(p_nivel bigint)
returns bigint
language sql
immutable
as $$
  select greatest(0, p_nivel - 1) * 3;
$$;

-- ============================================================================
-- Vitalidade máxima — agora considera o atributo Vitalidade
-- ============================================================================
create or replace function public.vitalidade_maxima(p_nivel bigint, p_vitalidade integer)
returns integer
language sql
immutable
as $$
  select (100 + p_nivel * 10 + p_vitalidade * 25)::integer;
$$;

-- ============================================================================
-- resolver_ciclos — motor de recompensa, agora com atributos
--
-- Trocada de assinatura: a versão de 4 argumentos sai para não deixar duas
-- verdades sobre a mesma regra convivendo no schema.
-- ============================================================================
drop function if exists public.resolver_ciclos(bigint, integer, integer, integer);

create or replace function public.resolver_ciclos(
  p_nivel               bigint,
  p_vitalidade_inicial  integer,
  p_ciclos              integer,
  p_multiplicador_xp    integer,
  p_forca               integer,
  p_inteligencia        integer,
  p_vitalidade          integer,
  out o_xp              bigint,
  out o_moeda           bigint,
  out o_vitalidade      integer,
  out o_ciclos_perdidos integer
)
language plpgsql
immutable
as $$
declare
  c_abates_base        constant integer := 3;
  c_xp_base_abate      constant integer := 4;
  c_moeda_base_abate   constant integer := 2;
  c_dano_base_ciclo    constant integer := 8;
  -- Força + Inteligência somam no mesmo termo: a separação entre dano físico e
  -- mágico só existe com tipo de dano de arma (`specs/equipamento-e-poder.md`).
  c_ataque_por_abate   constant integer := 8;

  v_abates_por_ciclo   integer;
  v_xp_por_abate       bigint;
  v_moeda_por_abate    bigint;
  v_dano_por_ciclo     integer;
  v_vitalidade_max     integer;
  v_i                  integer;
begin
  o_xp := 0;
  o_moeda := 0;
  o_ciclos_perdidos := 0;
  o_vitalidade := p_vitalidade_inicial;

  v_vitalidade_max   := public.vitalidade_maxima(p_nivel, coalesce(p_vitalidade, 0));
  v_abates_por_ciclo := c_abates_base + (p_nivel / 10)::integer
                        + ((coalesce(p_forca, 0) + coalesce(p_inteligencia, 0))
                           / c_ataque_por_abate);
  v_xp_por_abate     := c_xp_base_abate + p_nivel;
  v_moeda_por_abate  := c_moeda_base_abate + (p_nivel / 2);
  v_dano_por_ciclo   := c_dano_base_ciclo + p_nivel::integer;

  if o_vitalidade <= 0 or o_vitalidade > v_vitalidade_max then
    o_vitalidade := v_vitalidade_max;
  end if;

  if p_ciclos is null or p_ciclos <= 0 then
    return;
  end if;

  for v_i in 1 .. p_ciclos loop
    o_vitalidade := o_vitalidade - v_dano_por_ciclo;

    if o_vitalidade <= 0 then
      -- Derrota: perde só o ciclo em andamento e recomeça imediatamente.
      o_ciclos_perdidos := o_ciclos_perdidos + 1;
      o_vitalidade := v_vitalidade_max;
    else
      o_xp    := o_xp    + (v_abates_por_ciclo * v_xp_por_abate * p_multiplicador_xp);
      o_moeda := o_moeda + (v_abates_por_ciclo * v_moeda_por_abate);
    end if;
  end loop;
end;
$$;

revoke execute on function
  public.resolver_ciclos(bigint, integer, integer, integer, integer, integer, integer)
  from public;

-- ============================================================================
-- Auto-alocação — o que faz o Princípio nº1 valer aqui.
--
-- Quem nunca abrir a tela de atributos joga com uma build coerente: os pontos
-- são distribuídos sozinhos, sempre no atributo de menor nível. Como o custo
-- cresce com o nível, o menor é também o mais barato — se ele não couber no
-- saldo, nenhum outro caberia, e o laço para.
-- ============================================================================
create or replace function public.auto_alocar_atributos(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nivel   bigint;
  v_attr    public.atributo_jogador%rowtype;
  v_pontos  bigint;
  v_menor   integer;
  v_custo   integer;
begin
  insert into public.atributo_jogador (player_id) values (p_player_id)
  on conflict (player_id) do nothing;

  select nivel into v_nivel from public.jogador where id = p_player_id;
  select * into v_attr from public.atributo_jogador where player_id = p_player_id for update;

  -- Jogador que assumiu o controle manda: não redistribuímos por cima dele.
  if not v_attr.auto_alocar then
    return;
  end if;

  v_pontos := public.pontos_ganhos_ate(v_nivel)
              - public.custo_acumulado_atributo(v_attr.forca)
              - public.custo_acumulado_atributo(v_attr.inteligencia)
              - public.custo_acumulado_atributo(v_attr.vitalidade)
              - public.custo_acumulado_atributo(v_attr.sorte);

  loop
    v_menor := least(v_attr.forca, v_attr.inteligencia, v_attr.vitalidade, v_attr.sorte);
    v_custo := public.custo_proximo_nivel_atributo(v_menor);
    exit when v_custo > v_pontos;

    -- Desempate na ordem Força → Inteligência → Vitalidade → Sorte, igual ao
    -- espelho em TypeScript.
    if v_attr.forca = v_menor then
      v_attr.forca := v_attr.forca + 1;
    elsif v_attr.inteligencia = v_menor then
      v_attr.inteligencia := v_attr.inteligencia + 1;
    elsif v_attr.vitalidade = v_menor then
      v_attr.vitalidade := v_attr.vitalidade + 1;
    else
      v_attr.sorte := v_attr.sorte + 1;
    end if;

    v_pontos := v_pontos - v_custo;
  end loop;

  update public.atributo_jogador
     set forca         = v_attr.forca,
         inteligencia  = v_attr.inteligencia,
         vitalidade    = v_attr.vitalidade,
         sorte         = v_attr.sorte,
         atualizado_em = now()
   where player_id = p_player_id;
end;
$$;

revoke execute on function public.auto_alocar_atributos(uuid) from public, anon, authenticated;

-- ============================================================================
-- Snapshot — agora carrega atributos, pontos livres e apelido
-- ============================================================================
create or replace function public.montar_snapshot(p_uid uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_jog          public.jogador%rowtype;
  v_fs           public.farm_state%rowtype;
  v_ass          public.assinatura%rowtype;
  v_attr         public.atributo_jogador%rowtype;
  v_assinante    boolean;
  v_tem_email    boolean;
  v_credenciais  boolean;
  v_xp_base      numeric;
  v_xp_proximo   numeric;
  v_pontos_livres bigint;
begin
  select * into v_jog  from public.jogador          where id = p_uid;
  select * into v_fs   from public.farm_state       where player_id = p_uid;
  select * into v_ass  from public.assinatura       where player_id = p_uid;
  select * into v_attr from public.atributo_jogador where player_id = p_uid;

  if v_jog.id is null then
    return jsonb_build_object('existe', false);
  end if;

  v_assinante := coalesce(v_ass.status in ('ativa', 'cancelada')
                          and v_ass.expira_em > now(), false);

  select (email is not null and email <> ''),
         (coalesce(email, '') <> '' or coalesce(email_change, '') <> '')
    into v_tem_email, v_credenciais
    from auth.users
   where id = p_uid;

  v_xp_base    := public.xp_acumulado_para_nivel(v_jog.nivel);
  v_xp_proximo := public.xp_acumulado_para_nivel(v_jog.nivel + 1);

  v_pontos_livres := public.pontos_ganhos_ate(v_jog.nivel)
                     - public.custo_acumulado_atributo(coalesce(v_attr.forca, 0))
                     - public.custo_acumulado_atributo(coalesce(v_attr.inteligencia, 0))
                     - public.custo_acumulado_atributo(coalesce(v_attr.vitalidade, 0))
                     - public.custo_acumulado_atributo(coalesce(v_attr.sorte, 0));

  return jsonb_build_object(
    'existe', true,
    'jogador', jsonb_build_object(
      'nivel',              v_jog.nivel,
      'xpTotal',            v_jog.xp_total,
      'xpNoNivel',          (v_jog.xp_total - v_xp_base)::bigint,
      'xpParaProximoNivel', (v_xp_proximo - v_xp_base)::bigint,
      'moeda',              v_jog.moeda,
      'vitalidadeAtual',    v_jog.vitalidade_atual,
      'vitalidadeMaxima',   public.vitalidade_maxima(v_jog.nivel,
                                                     coalesce(v_attr.vitalidade, 0)),
      'idioma',             v_jog.idioma,
      'apelido',            v_jog.apelido,
      'temCadastro',        coalesce(v_tem_email, false),
      'identidadeVerificada', (v_jog.data_nascimento is not null
                               and coalesce(v_credenciais, false))
    ),
    'atributos', jsonb_build_object(
      'forca',        coalesce(v_attr.forca, 0),
      'inteligencia', coalesce(v_attr.inteligencia, 0),
      'vitalidade',   coalesce(v_attr.vitalidade, 0),
      'sorte',        coalesce(v_attr.sorte, 0),
      'pontosLivres', greatest(0, v_pontos_livres),
      'autoAlocar',   coalesce(v_attr.auto_alocar, true)
    ),
    'farm', jsonb_build_object(
      'minutosAcumulados',        v_fs.minutos_acumulados,
      'xpPendente',               v_fs.xp_pendente,
      'moedaPendente',            v_fs.moeda_pendente,
      'minutosAnuncioSaldo',      v_fs.minutos_anuncio_saldo,
      'minutosAnuncioRestantes',  greatest(0, 120 - v_fs.minutos_anuncio_creditados),
      'ultimoMotivo',             v_fs.ultimo_motivo
    ),
    'assinatura', jsonb_build_object(
      'ativa',     v_assinante,
      'status',    coalesce(v_ass.status, 'inexistente'),
      'expiraEm',  v_ass.expira_em,
      'multiplicadorXp', case when v_assinante then 2 else 1 end,
      'tetoOfflineMinutos', case when v_assinante then 1440
                                 else v_fs.minutos_anuncio_saldo end
    )
  );
end;
$$;

revoke execute on function public.montar_snapshot(uuid) from public;

-- ============================================================================
-- iniciar_sessao — substituída para passar atributos ao motor de recompensa e
-- para creditar os pontos de TODOS os níveis ganhos na ausência.
-- ============================================================================
create or replace function public.iniciar_sessao()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_limite_lote_segundos constant integer := 120;
  c_ciclo_segundos       constant integer := 15;
  c_teto_assinante_min   constant integer := 1440;

  v_uid                uuid := auth.uid();
  v_fs                 public.farm_state%rowtype;
  v_jog                public.jogador%rowtype;
  v_ass                public.assinatura%rowtype;
  v_attr               public.atributo_jogador%rowtype;

  v_assinante          boolean;
  v_multiplicador      integer;
  v_segundos           numeric;
  v_minutos_decorridos integer;
  v_teto_minutos       integer;
  v_minutos_creditados integer;
  v_ciclos             integer;
  v_motivo             text;
  v_venceu             boolean := false;

  v_xp                 bigint;
  v_moeda              bigint;
  v_vitalidade         integer;
  v_perdidos           integer;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  insert into public.jogador (id)             values (v_uid) on conflict (id) do nothing;
  insert into public.farm_state (player_id)    values (v_uid) on conflict (player_id) do nothing;
  insert into public.assinatura (player_id)    values (v_uid) on conflict (player_id) do nothing;
  insert into public.atributo_jogador (player_id) values (v_uid) on conflict (player_id) do nothing;

  select * into v_fs   from public.farm_state       where player_id = v_uid for update;
  select * into v_jog  from public.jogador          where id = v_uid        for update;
  select * into v_ass  from public.assinatura       where player_id = v_uid for update;
  select * into v_attr from public.atributo_jogador where player_id = v_uid;

  if v_ass.status in ('ativa', 'cancelada') and v_ass.expira_em <= now() then
    update public.assinatura
       set status = 'vencida', atualizada_em = now()
     where player_id = v_uid;

    v_fs.minutos_acumulados := 0;
    v_fs.xp_pendente        := 0;
    v_fs.moeda_pendente     := 0;
    v_venceu := true;

    insert into public.evento_jogo (player_id, tipo, dados)
    values (v_uid, 'assinatura.vencida', jsonb_build_object('pendenteZerado', true));
  end if;

  v_assinante := (v_ass.status in ('ativa', 'cancelada') and v_ass.expira_em > now());
  v_multiplicador := case when v_assinante then 2 else 1 end;

  if now() - v_fs.janela_anuncio_iniciada_em >= interval '24 hours' then
    v_fs.minutos_anuncio_creditados := 0;
    v_fs.janela_anuncio_iniciada_em := now();
  end if;

  v_segundos := extract(epoch from (now() - v_fs.last_seen_at));

  if v_segundos <= c_limite_lote_segundos then
    -- Recarregar a página ou um blip de rede não é "ficar offline".
    v_ciclos := floor(v_segundos / c_ciclo_segundos)::integer;

    select o_xp, o_moeda, o_vitalidade, o_ciclos_perdidos
      into v_xp, v_moeda, v_vitalidade, v_perdidos
      from public.resolver_ciclos(v_jog.nivel, v_jog.vitalidade_atual, v_ciclos,
                                  v_multiplicador, v_attr.forca, v_attr.inteligencia,
                                  v_attr.vitalidade);

    update public.jogador
       set xp_total         = xp_total + v_xp,
           moeda            = moeda + v_moeda,
           nivel            = public.nivel_por_xp(xp_total + v_xp),
           vitalidade_atual = v_vitalidade,
           atualizado_em    = now()
     where id = v_uid;

    update public.farm_state
       set last_seen_at = v_fs.last_seen_at
                          + make_interval(secs => v_ciclos * c_ciclo_segundos),
           minutos_acumulados         = v_fs.minutos_acumulados,
           xp_pendente                = v_fs.xp_pendente,
           moeda_pendente             = v_fs.moeda_pendente,
           minutos_anuncio_creditados = v_fs.minutos_anuncio_creditados,
           janela_anuncio_iniciada_em = v_fs.janela_anuncio_iniciada_em,
           ultimo_motivo              = case when v_venceu then 'assinatura_vencida'
                                             else v_fs.ultimo_motivo end
     where player_id = v_uid;

    perform public.auto_alocar_atributos(v_uid);

    return public.montar_snapshot(v_uid) || jsonb_build_object(
      'retorno', jsonb_build_object(
        'houveAusencia',      false,
        'minutosDecorridos',  0,
        'minutosCreditados',  0,
        'xpGanho',            0,
        'moedaGanha',         0,
        'tetoMinutos',        case when v_assinante then c_teto_assinante_min
                                   else v_fs.minutos_anuncio_saldo end,
        'motivo',             case when v_venceu then 'assinatura_vencida'
                                   else 'primeira_sessao' end
      )
    );
  end if;

  v_minutos_decorridos := floor(v_segundos / 60)::integer;

  if v_assinante then
    v_teto_minutos := c_teto_assinante_min;
  else
    v_teto_minutos := v_fs.minutos_anuncio_saldo;
  end if;

  v_minutos_creditados := least(v_minutos_decorridos, v_teto_minutos);
  v_ciclos := (v_minutos_creditados * 60 / c_ciclo_segundos)::integer;

  select o_xp, o_moeda, o_vitalidade, o_ciclos_perdidos
    into v_xp, v_moeda, v_vitalidade, v_perdidos
    from public.resolver_ciclos(v_jog.nivel, v_jog.vitalidade_atual, v_ciclos,
                                v_multiplicador, v_attr.forca, v_attr.inteligencia,
                                v_attr.vitalidade);

  if v_venceu then
    v_motivo := 'assinatura_vencida';
  elsif v_minutos_creditados = 0 then
    v_motivo := 'sem_desbloqueio';
  elsif v_minutos_creditados < v_minutos_decorridos then
    v_motivo := case when v_assinante then 'teto_assinante' else 'teto_anuncio' end;
  else
    v_motivo := 'creditado';
  end if;

  update public.jogador
     set vitalidade_atual = v_vitalidade,
         atualizado_em    = now()
   where id = v_uid;

  update public.farm_state
     set last_seen_at               = now(),
         minutos_acumulados         = v_fs.minutos_acumulados + v_minutos_creditados,
         xp_pendente                = v_fs.xp_pendente + v_xp,
         moeda_pendente             = v_fs.moeda_pendente + v_moeda,
         minutos_anuncio_saldo      = case when v_assinante then v_fs.minutos_anuncio_saldo
                                           else v_fs.minutos_anuncio_saldo - v_minutos_creditados end,
         minutos_anuncio_creditados = v_fs.minutos_anuncio_creditados,
         janela_anuncio_iniciada_em = v_fs.janela_anuncio_iniciada_em,
         ultimo_motivo              = v_motivo
   where player_id = v_uid;

  insert into public.evento_jogo (player_id, tipo, dados)
  values (v_uid, 'farm.calculado',
          jsonb_build_object('minutosDecorridos', v_minutos_decorridos,
                             'minutosCreditados', v_minutos_creditados,
                             'motivo', v_motivo));

  return public.montar_snapshot(v_uid) || jsonb_build_object(
    'retorno', jsonb_build_object(
      'houveAusencia',     true,
      'minutosDecorridos', v_minutos_decorridos,
      'minutosCreditados', v_minutos_creditados,
      'xpGanho',           v_xp,
      'moedaGanha',        v_moeda,
      'ciclosPerdidos',    v_perdidos,
      'tetoMinutos',       v_teto_minutos,
      'motivo',            v_motivo
    )
  );
end;
$$;

-- ============================================================================
-- validar_lote — mesma substituição, pelo mesmo motivo
-- ============================================================================
create or replace function public.validar_lote()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_limite_lote_segundos constant integer := 120;
  c_ciclo_segundos       constant integer := 15;

  v_uid            uuid := auth.uid();
  v_fs             public.farm_state%rowtype;
  v_jog            public.jogador%rowtype;
  v_ass            public.assinatura%rowtype;
  v_attr           public.atributo_jogador%rowtype;
  v_assinante      boolean;
  v_multiplicador  integer;
  v_segundos       numeric;
  v_segundos_uteis numeric;
  v_ciclos         integer;
  v_nivel_antes    bigint;
  v_xp             bigint;
  v_moeda          bigint;
  v_vitalidade     integer;
  v_perdidos       integer;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select * into v_fs from public.farm_state where player_id = v_uid for update;
  if v_fs.player_id is null then
    raise exception 'SESSAO_NAO_INICIADA';
  end if;

  select * into v_jog  from public.jogador          where id = v_uid;
  select * into v_ass  from public.assinatura       where player_id = v_uid;
  select * into v_attr from public.atributo_jogador where player_id = v_uid;

  v_assinante := coalesce(v_ass.status in ('ativa', 'cancelada')
                          and v_ass.expira_em > now(), false);
  v_multiplicador := case when v_assinante then 2 else 1 end;

  v_segundos := extract(epoch from (now() - v_fs.last_seen_at));
  v_segundos_uteis := least(v_segundos, c_limite_lote_segundos);
  v_ciclos := floor(v_segundos_uteis / c_ciclo_segundos)::integer;

  if v_ciclos <= 0 then
    return public.montar_snapshot(v_uid) || jsonb_build_object(
      'lote', jsonb_build_object('ciclos', 0, 'xpGanho', 0, 'moedaGanha', 0)
    );
  end if;

  select o_xp, o_moeda, o_vitalidade, o_ciclos_perdidos
    into v_xp, v_moeda, v_vitalidade, v_perdidos
    from public.resolver_ciclos(v_jog.nivel, v_jog.vitalidade_atual, v_ciclos,
                                v_multiplicador, coalesce(v_attr.forca, 0),
                                coalesce(v_attr.inteligencia, 0),
                                coalesce(v_attr.vitalidade, 0));

  v_nivel_antes := v_jog.nivel;

  update public.jogador
     set xp_total         = xp_total + v_xp,
         moeda            = moeda + v_moeda,
         nivel            = public.nivel_por_xp(xp_total + v_xp),
         vitalidade_atual = v_vitalidade,
         atualizado_em    = now()
   where id = v_uid
  returning nivel into v_jog.nivel;

  update public.farm_state
     set last_seen_at = now()
                        - make_interval(secs => (v_segundos_uteis - v_ciclos * c_ciclo_segundos))
   where player_id = v_uid;

  -- Subiu de nível: os pontos novos são distribuídos sozinhos (Princípio nº1).
  if v_jog.nivel > v_nivel_antes then
    perform public.auto_alocar_atributos(v_uid);
  end if;

  return public.montar_snapshot(v_uid) || jsonb_build_object(
    'lote', jsonb_build_object(
      'ciclos',         v_ciclos,
      'ciclosPerdidos', v_perdidos,
      'xpGanho',        v_xp,
      'moedaGanha',     v_moeda,
      'subiuDeNivel',   v_jog.nivel > v_nivel_antes
    )
  );
end;
$$;

-- ============================================================================
-- coletar_farm_offline — precisa auto-alocar os pontos de todos os níveis
-- ganhos durante a ausência (edge case da spec de origem)
-- ============================================================================
create or replace function public.coletar_farm_offline()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_fs    public.farm_state%rowtype;
  v_xp    bigint;
  v_moeda bigint;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select * into v_fs from public.farm_state where player_id = v_uid for update;
  if v_fs.player_id is null then
    raise exception 'SESSAO_NAO_INICIADA';
  end if;

  v_xp    := v_fs.xp_pendente;
  v_moeda := v_fs.moeda_pendente;

  update public.farm_state
     set minutos_acumulados = 0,
         xp_pendente        = 0,
         moeda_pendente     = 0
   where player_id = v_uid;

  if v_xp > 0 or v_moeda > 0 then
    update public.jogador
       set xp_total      = xp_total + v_xp,
           moeda         = moeda + v_moeda,
           nivel         = public.nivel_por_xp(xp_total + v_xp),
           atualizado_em = now()
     where id = v_uid;

    -- Uma ausência longa pode render muitos níveis de uma vez; a auto-alocação
    -- distribui os pontos de todos eles, não só do último.
    perform public.auto_alocar_atributos(v_uid);

    insert into public.evento_jogo (player_id, tipo, dados)
    values (v_uid, 'farm.coletado', jsonb_build_object('xp', v_xp, 'moeda', v_moeda));
  end if;

  return public.montar_snapshot(v_uid) || jsonb_build_object(
    'coleta', jsonb_build_object('xpColetado', v_xp, 'moedaColetada', v_moeda)
  );
end;
$$;

-- ============================================================================
-- redistribuir_atributos — respec livre (critérios 9, 10 e 12 da spec)
--
-- Esta RPC ACEITA parâmetros, e isso é legítimo: o jogador está escolhendo uma
-- alocação, não declarando um ganho. O servidor confere que o custo acumulado
-- da alocação pedida cabe nos pontos que ele ganhou na vida — e é essa
-- comparação por custo ACUMULADO que faz o respec devolver exatamente o que
-- cobrou, sem nenhuma contabilidade de "quanto foi gasto em cada nível".
-- ============================================================================
create or replace function public.redistribuir_atributos(
  p_forca        integer,
  p_inteligencia integer,
  p_vitalidade   integer,
  p_sorte        integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_nivel  bigint;
  v_custo  bigint;
  v_pontos bigint;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  if p_forca is null or p_inteligencia is null or p_vitalidade is null or p_sorte is null
     or p_forca < 0 or p_inteligencia < 0 or p_vitalidade < 0 or p_sorte < 0 then
    raise exception 'ATRIBUTO_INVALIDO';
  end if;

  select nivel into v_nivel from public.jogador where id = v_uid;
  if v_nivel is null then
    raise exception 'SESSAO_NAO_INICIADA';
  end if;

  v_custo := public.custo_acumulado_atributo(p_forca)
             + public.custo_acumulado_atributo(p_inteligencia)
             + public.custo_acumulado_atributo(p_vitalidade)
             + public.custo_acumulado_atributo(p_sorte);

  v_pontos := public.pontos_ganhos_ate(v_nivel);

  if v_custo > v_pontos then
    raise exception 'PONTOS_INSUFICIENTES';
  end if;

  -- A partir daqui a distribuição é do jogador: desligar a auto-alocação é o
  -- que impede o servidor de desfazer a escolha dele no lote seguinte.
  insert into public.atributo_jogador
    (player_id, forca, inteligencia, vitalidade, sorte, auto_alocar)
  values (v_uid, p_forca, p_inteligencia, p_vitalidade, p_sorte, false)
  on conflict (player_id) do update
    set forca         = excluded.forca,
        inteligencia  = excluded.inteligencia,
        vitalidade    = excluded.vitalidade,
        sorte         = excluded.sorte,
        auto_alocar   = false,
        atualizado_em = now();

  insert into public.evento_jogo (player_id, tipo, dados)
  values (v_uid, 'atributo.redistribuido',
          jsonb_build_object('forca', p_forca, 'inteligencia', p_inteligencia,
                             'vitalidade', p_vitalidade, 'sorte', p_sorte));

  return public.montar_snapshot(v_uid);
end;
$$;

-- ============================================================================
-- reativar_auto_alocacao — devolve o volante ao servidor.
--
-- Sem parâmetro: o jogador está pedindo "cuida disso pra mim", não propondo
-- uma distribuição. E como o respec é livre e sem penalidade, alternar entre
-- automático e manual não custa nada nem exige confirmação.
-- ============================================================================
create or replace function public.reativar_auto_alocacao()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  insert into public.atributo_jogador (player_id, auto_alocar) values (v_uid, true)
  on conflict (player_id) do update set auto_alocar = true, atualizado_em = now();

  perform public.auto_alocar_atributos(v_uid);

  insert into public.evento_jogo (player_id, tipo, dados)
  values (v_uid, 'atributo.auto_reativado', '{}'::jsonb);

  return public.montar_snapshot(v_uid);
end;
$$;

-- ============================================================================
-- definir_apelido — porta de entrada do ranking
-- ============================================================================
create or replace function public.definir_apelido(p_apelido text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_limpo    text;
  v_posicao  integer;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  v_limpo := btrim(coalesce(p_apelido, ''));

  if char_length(v_limpo) < 3 or char_length(v_limpo) > 20 then
    raise exception 'APELIDO_TAMANHO_INVALIDO';
  end if;

  -- Caractere de controle vira texto invisível no placar público.
  if v_limpo ~ '[[:cntrl:]]' then
    raise exception 'APELIDO_CARACTERE_INVALIDO';
  end if;

  update public.jogador set apelido = v_limpo, atualizado_em = now() where id = v_uid;

  -- Entra no placar na hora, sem esperar o próximo recompute — senão parece
  -- que definir o apelido não funcionou (edge case da spec de origem).
  select 1 + count(*)
    into v_posicao
    from public.jogador
   where apelido is not null
     and id <> v_uid
     and (nivel, xp_total) > (select nivel, xp_total from public.jogador where id = v_uid);

  insert into public.ranking_posicao (player_id, apelido, nivel, xp_total, posicao)
  select id, apelido, nivel, xp_total, v_posicao from public.jogador where id = v_uid
  on conflict (player_id) do update
    set apelido       = excluded.apelido,
        nivel         = excluded.nivel,
        xp_total      = excluded.xp_total,
        posicao       = excluded.posicao,
        atualizado_em = now();

  return public.montar_snapshot(v_uid);
end;
$$;

-- ============================================================================
-- recomputar_ranking — chamada periodicamente (pg_cron), nunca pelo client.
--
-- Roda dentro do Postgres: nenhum worker, nenhum processo persistente, nada
-- que contrarie ADR-001 ou a restrição técnica de `memory/restrictions.md`.
-- ============================================================================
create or replace function public.recomputar_ranking()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total integer;
begin
  delete from public.ranking_posicao;

  insert into public.ranking_posicao (player_id, apelido, nivel, xp_total, posicao)
  select j.id, j.apelido, j.nivel, j.xp_total,
         row_number() over (
           -- Desempate: maior XP e, persistindo, quem chegou primeiro. A spec
           -- de origem deixava "a definir"; fica registrado como reversível.
           order by j.nivel desc, j.xp_total desc, j.criado_em asc
         )
    from public.jogador j
   where j.apelido is not null;

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

revoke execute on function public.recomputar_ranking() from public, anon, authenticated;
grant execute on function public.recomputar_ranking() to service_role;

-- ============================================================================
-- ranking_global — leitura do placar. Sem parâmetro: o top é fixo em 100 e o
-- "eu" sai de auth.uid().
-- ============================================================================
create or replace function public.ranking_global()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_top constant integer := 100;

  v_uid uuid := auth.uid();
  v_top jsonb;
  v_eu  jsonb;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select coalesce(jsonb_agg(linha order by linha_posicao), '[]'::jsonb)
    into v_top
    from (
      select jsonb_build_object(
               'posicao', r.posicao,
               'apelido', r.apelido,
               'nivel',   r.nivel,
               'euMesmo', r.player_id = v_uid
             ) as linha,
             r.posicao as linha_posicao
        from public.ranking_posicao r
       order by r.posicao
       limit c_top
    ) as topo;

  -- A própria posição aparece sempre, mesmo fora do top (critério 6 da spec).
  select jsonb_build_object(
           'posicao', r.posicao,
           'apelido', r.apelido,
           'nivel',   r.nivel,
           'euMesmo', true
         )
    into v_eu
    from public.ranking_posicao r
   where r.player_id = v_uid;

  return jsonb_build_object(
    'top', v_top,
    'eu', v_eu,                                    -- null enquanto não houver apelido
    'atualizadoEm', (select max(atualizado_em) from public.ranking_posicao)
  );
end;
$$;

-- ============================================================================
-- RLS das tabelas novas
-- ============================================================================
alter table public.atributo_jogador enable row level security;
alter table public.ranking_posicao  enable row level security;

drop policy if exists atributo_le_proprio on public.atributo_jogador;
create policy atributo_le_proprio on public.atributo_jogador
  for select using (auth.uid() = player_id);

-- EXCEÇÃO DELIBERADA ao isolamento por player_id (ADR-002): placar é público
-- por natureza. O que fica exposto são apelido, nível e posição — nunca
-- e-mail, data de nascimento ou qualquer dado pessoal. E o jogador só entra
-- aqui depois de escolher um apelido, que é o opt-in.
drop policy if exists ranking_leitura_publica on public.ranking_posicao;
create policy ranking_leitura_publica on public.ranking_posicao
  for select using (auth.uid() is not null);

revoke all on public.atributo_jogador from anon, authenticated;
revoke all on public.ranking_posicao  from anon, authenticated;

grant select on public.atributo_jogador to authenticated;
-- `player_id` e `xp_total` ficam de fora: o primeiro deixaria qualquer jogador
-- mapear apelido → id de conta alheia, e o segundo é só critério de desempate.
-- Quem precisa deles é `ranking_global()`, que roda como SECURITY DEFINER.
grant select (apelido, nivel, posicao, atualizado_em)
  on public.ranking_posicao to authenticated;

-- ============================================================================
-- Permissões das RPCs novas
-- ============================================================================
revoke execute on function public.redistribuir_atributos(integer, integer, integer, integer)
  from public;
revoke execute on function public.reativar_auto_alocacao() from public;
revoke execute on function public.definir_apelido(text)    from public;
revoke execute on function public.ranking_global()         from public;

grant execute on function public.redistribuir_atributos(integer, integer, integer, integer)
  to authenticated;
grant execute on function public.reativar_auto_alocacao() to authenticated;
grant execute on function public.definir_apelido(text)    to authenticated;
grant execute on function public.ranking_global()         to authenticated;
