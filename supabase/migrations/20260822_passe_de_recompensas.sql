-- ============================================================================
-- Autohunt Idle — passe de recompensas.
--
-- Implementa `specs/passe-de-recompensas.md` (ver
-- `specs/build-fase-3h-passe-de-recompensas.md`).
--
-- TRÊS INVARIANTES SUSTENTAM ESTE ARQUIVO, e os três viram teste:
--
--   1. NADA SORTEIA. A recompensa de cada tier está escrita na tabela, e o
--      jogador a lê antes de comprar. Um passe pago cuja recompensa é
--      desconhecida na hora da compra É recompensa aleatória paga — a
--      restrição CRÍTICA permanente do projeto. Repare que `conceder_recompensa_passe`
--      faz um `insert` direto, e NÃO chama `conceder_item` (que sorteia).
--
--   2. NADA EXPIRA. Não há coluna de prazo, temporada ou validade em lugar
--      nenhum desta migration. É a restrição "sem dark pattern de urgência".
--
--   3. NADA É RETIRADO. Desativar o passe para o progresso e não toca em item
--      nenhum. Não existe `delete from item_jogador` com origem 'passe'.
-- ============================================================================

-- A trilha concede itens, e eles precisam de uma origem própria — é ela que
-- torna auditável de onde veio cada prêmio.
alter table public.item_jogador drop constraint if exists item_jogador_origem_check;
alter table public.item_jogador add constraint item_jogador_origem_check
  check (origem in ('mundo', 'mini_boss', 'dungeon', 'sintese', 'passe'));

-- Exclusividade estrutural (critério 9): nenhuma outra rota do jogo marca isto.
alter table public.item_jogador
  add column if not exists exclusivo_do_passe boolean not null default false;

comment on column public.item_jogador.exclusivo_do_passe is
  'Marcado SÓ pela trilha do passe. Nenhuma outra rota concede item exclusivo — é o que sustenta a exclusividade da skin.';

-- ---------------------------------------------------------------------------
-- A trilha — dado em tabela, não número escondido em função.
--
-- Ser tabela é o que permite publicar a trilha inteira antes da compra (é a
-- diferença entre isto e uma loot box) e o que torna trocar prêmio um `update`
-- em vez de uma migration. A spec de origem confirma só a skin exclusiva; o
-- resto nasce placeholder, e ela diz isso.
--
-- REPARE NO QUE NÃO EXISTE AQUI: nenhuma coluna de prazo, temporada, validade
-- ou data de expiração. Ausência deliberada, verificada por teste.
-- ---------------------------------------------------------------------------
create table if not exists public.passe_recompensa (
  tier                integer primary key check (tier > 0),
  pontos_necessarios  bigint  not null check (pontos_necessarios > 0),

  tipo                text    not null,
  raridade            smallint not null check (raridade between 1 and 10),
  -- A skin exclusiva. Mais de uma pode ser marcada; nenhuma outra rota marca.
  exclusiva           boolean not null default false,
  ativo               boolean not null default true
);

insert into public.passe_recompensa (tier, pontos_necessarios, tipo, raridade, exclusiva) values
  ( 1,   100, 'chave',              1, false),
  ( 2,   300, 'pedra_fortificacao', 1, false),
  ( 3,   600, 'acessorio',          4, false),
  ( 4,  1000, 'pedra_sorte',        1, false),
  ( 5,  1500, 'arma',               5, false),
  ( 6,  2200, 'capacete',           5, false),
  ( 7,  3000, 'pedra_garantia',     1, false),
  ( 8,  4000, 'armadura',           6, false),
  ( 9,  5200, 'luva',               6, false),
  (10,  6600, 'bota',               6, false),
  (11,  8200, 'acessorio',          7, false),
  (12, 10000, 'skin',               8, true)
on conflict (tier) do nothing;

comment on table public.passe_recompensa is
  'Trilha do passe. Recompensa específica e conhecida por tier — nunca sorteio. Sem prazo: nada aqui expira.';

alter table public.passe_recompensa enable row level security;

drop policy if exists passe_trilha_publica on public.passe_recompensa;
-- Pública por natureza: o jogador precisa ver a trilha inteira ANTES de
-- decidir comprar. Não há dado pessoal aqui.
create policy passe_trilha_publica on public.passe_recompensa
  for select using (auth.uid() is not null);

revoke all on public.passe_recompensa from anon, authenticated;
grant select on public.passe_recompensa to authenticated;

-- ---------------------------------------------------------------------------
-- Progresso do jogador na trilha
-- ---------------------------------------------------------------------------
create table if not exists public.passe_jogador (
  player_id     uuid primary key references public.jogador (id) on delete cascade,

  ativo         boolean not null default false,
  pontos        bigint  not null default 0 check (pontos >= 0),
  tier          integer not null default 0 check (tier >= 0),

  ativado_em    timestamptz,
  referencia_externa text,
  atualizado_em timestamptz not null default now()
);

comment on table public.passe_jogador is
  'Progresso do passe. Escrita só por RPC de servidor — o client nunca se declara portador nem informa pontos.';

alter table public.passe_jogador enable row level security;

drop policy if exists passe_jogador_propria on public.passe_jogador;
create policy passe_jogador_propria on public.passe_jogador
  for select using (player_id = auth.uid());

revoke all on public.passe_jogador from anon, authenticated;
-- Sem `referencia_externa`: é o identificador do jogador no gateway, mesmo
-- motivo pelo qual ele não aparece no grant de `assinatura`.
grant select (player_id, ativo, pontos, tier, ativado_em) on public.passe_jogador to authenticated;

-- ============================================================================
-- ativar_passe / desativar_passe — CHAMÁVEIS SÓ PELO SERVIDOR.
--
-- Mesmo padrão da assinatura: quem paga é confirmado por webhook assinado do
-- gateway, nunca por uma chamada do client dizendo "comprei".
-- ============================================================================
create or replace function public.ativar_passe(
  p_player_id  uuid,
  p_referencia text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.passe_jogador (player_id, ativo, ativado_em, referencia_externa)
  values (p_player_id, true, now(), p_referencia)
  on conflict (player_id) do update
     set ativo              = true,
         ativado_em         = coalesce(public.passe_jogador.ativado_em, now()),
         referencia_externa = coalesce(excluded.referencia_externa,
                                       public.passe_jogador.referencia_externa),
         atualizado_em      = now();

  insert into public.evento_jogo (player_id, tipo, dados)
  values (p_player_id, 'passe.ativado', '{}'::jsonb);
end;
$$;

revoke execute on function public.ativar_passe(uuid, text) from public, anon, authenticated;
grant execute on function public.ativar_passe(uuid, text) to service_role;

create or replace function public.desativar_passe(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Só desliga o progresso. Item concedido continua sendo do jogador — é o
  -- critério 4 da spec de origem, e não há caminho aqui que apague nada.
  update public.passe_jogador
     set ativo = false, atualizado_em = now()
   where player_id = p_player_id;

  insert into public.evento_jogo (player_id, tipo, dados)
  values (p_player_id, 'passe.desativado', '{}'::jsonb);
end;
$$;

revoke execute on function public.desativar_passe(uuid) from public, anon, authenticated;
grant execute on function public.desativar_passe(uuid) to service_role;

-- ============================================================================
-- conceder_recompensa_passe — o item exato que a trilha promete.
--
-- `insert` direto, DE PROPÓSITO. Não chama `conceder_item`, que sorteia
-- raridade a partir de piso/teto: aqui a raridade vem escrita da tabela, e é a
-- mesma que o jogador leu na tela antes de comprar.
-- ============================================================================
create or replace function public.conceder_recompensa_passe(
  p_player_id uuid,
  p_tier      integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_r public.passe_recompensa%rowtype;
begin
  select * into v_r from public.passe_recompensa where tier = p_tier and ativo;
  if v_r.tier is null then
    return null;
  end if;

  insert into public.item_jogador (player_id, tipo, raridade, origem, exclusivo_do_passe)
  values (p_player_id, v_r.tipo, v_r.raridade, 'passe', v_r.exclusiva);

  return jsonb_build_object('tier', v_r.tier, 'tipo', v_r.tipo,
                            'raridade', v_r.raridade, 'exclusiva', v_r.exclusiva);
end;
$$;

revoke execute on function public.conceder_recompensa_passe(uuid, integer)
  from public, anon, authenticated;

-- ============================================================================
-- progredir_passe — soma pontos e cruza os tiers que couberem.
--
-- Chamada de dentro de `creditar_ciclos`: o progresso vem da mesma rota que já
-- credita XP e moeda, então o client nunca informa quantos pontos ganhou.
-- ============================================================================
create or replace function public.progredir_passe(
  p_player_id uuid,
  p_pontos    bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_p          public.passe_jogador%rowtype;
  v_novos      bigint;
  v_tier       integer;
  v_concedidas jsonb := '[]'::jsonb;
  v_uma        jsonb;
begin
  if p_pontos <= 0 then
    return v_concedidas;
  end if;

  select * into v_p from public.passe_jogador where player_id = p_player_id for update;

  -- Sem passe, sem ponto (critério 4). Quem cancelou não regride: o tier e os
  -- pontos ficam parados exatamente onde estavam.
  if v_p.player_id is null or not v_p.ativo then
    return v_concedidas;
  end if;

  v_novos := v_p.pontos + p_pontos;
  v_tier  := v_p.tier;

  -- Um tier de cada vez, em ordem: uma ausência longa concede vários, e nunca
  -- pula nenhum (edge case da spec).
  loop
    exit when not exists (
      select 1 from public.passe_recompensa
       where tier = v_tier + 1 and ativo and pontos_necessarios <= v_novos
    );

    v_tier := v_tier + 1;
    v_uma  := public.conceder_recompensa_passe(p_player_id, v_tier);
    if v_uma is not null then
      v_concedidas := v_concedidas || jsonb_build_array(v_uma);
    end if;
  end loop;

  update public.passe_jogador
     set pontos = v_novos, tier = v_tier, atualizado_em = now()
   where player_id = p_player_id;

  if jsonb_array_length(v_concedidas) > 0 then
    insert into public.evento_jogo (player_id, tipo, dados)
    values (p_player_id, 'passe.tier', jsonb_build_object('tier', v_tier));
  end if;

  return v_concedidas;
end;
$$;

revoke execute on function public.progredir_passe(uuid, bigint)
  from public, anon, authenticated;

-- ============================================================================
-- creditar_ciclos — passa a alimentar o passe
--
-- Um ponto por ciclo. É balanceamento (D4 do backlog), não regra: o número
-- vive aqui e na tabela da trilha, e muda com `update`.
-- ============================================================================
create or replace function public.creditar_ciclos(
  p_player_id     uuid,
  p_ciclos        integer,
  p_multiplicador integer,
  p_para_pendente boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_jog         public.jogador%rowtype;
  v_attr        public.atributo_jogador%rowtype;
  v_poder       integer;
  v_nivel_antes bigint;
  v_xp          bigint;
  v_moeda       bigint;
  v_vitalidade  integer;
  v_perdidos    integer;
  v_drops       jsonb;
  v_passe       jsonb;
begin
  perform public.garantir_arma_inicial(p_player_id);

  select * into v_jog  from public.jogador          where id = p_player_id;
  select * into v_attr from public.atributo_jogador where player_id = p_player_id;

  v_poder := public.poder_de_ataque(p_player_id);

  select o_xp, o_moeda, o_vitalidade, o_ciclos_perdidos
    into v_xp, v_moeda, v_vitalidade, v_perdidos
    from public.resolver_ciclos(v_jog.nivel, v_jog.vitalidade_atual, p_ciclos,
                                p_multiplicador, v_poder, coalesce(v_attr.vitalidade, 0));

  v_nivel_antes := v_jog.nivel;

  if p_para_pendente then
    update public.jogador
       set vitalidade_atual = v_vitalidade, atualizado_em = now()
     where id = p_player_id;

    update public.farm_state
       set xp_pendente = xp_pendente + v_xp, moeda_pendente = moeda_pendente + v_moeda
     where player_id = p_player_id;
  else
    update public.jogador
       set xp_total         = xp_total + v_xp,
           moeda            = moeda + v_moeda,
           nivel            = public.nivel_por_xp(xp_total + v_xp),
           vitalidade_atual = v_vitalidade,
           atualizado_em    = now()
     where id = p_player_id
    returning nivel into v_jog.nivel;

    if v_jog.nivel > v_nivel_antes then
      perform public.auto_alocar_atributos(p_player_id);
    end if;
  end if;

  v_drops := public.resolver_drops(p_player_id, p_ciclos, coalesce(v_attr.sorte, 0));

  -- O passe progride junto com o resto, inclusive no farm offline: é a mesma
  -- rota de crédito, e separar exigiria um segundo caminho — a bifurcação que
  -- a arquitetura evita desde a Fase 1.
  v_passe := public.progredir_passe(p_player_id, p_ciclos::bigint);

  return jsonb_build_object(
    'xp', v_xp, 'moeda', v_moeda, 'ciclosPerdidos', v_perdidos,
    'poderDeAtaque', v_poder,
    'subiuDeNivel', v_jog.nivel > v_nivel_antes, 'drops', v_drops,
    'passe', v_passe
  );
end;
$$;

revoke execute on function public.creditar_ciclos(uuid, integer, integer, boolean)
  from public, anon, authenticated;

-- ============================================================================
-- montar_passe — o que o client precisa para desenhar a trilha inteira
-- ============================================================================
create or replace function public.montar_passe(p_uid uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'ativo',  coalesce((select ativo  from public.passe_jogador where player_id = p_uid), false),
    'pontos', coalesce((select pontos from public.passe_jogador where player_id = p_uid), 0),
    'tier',   coalesce((select tier   from public.passe_jogador where player_id = p_uid), 0),
    -- A trilha inteira, SEMPRE — inclusive para quem ainda não comprou. É o que
    -- permite ver exatamente o que se está comprando antes de pagar, e é a
    -- diferença entre este passe e uma caixa de recompensa aleatória.
    'trilha', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tier', tier, 'pontos', pontos_necessarios,
               'tipo', tipo, 'raridade', raridade, 'exclusiva', exclusiva)
             order by tier)
        from public.passe_recompensa where ativo
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.montar_passe(uuid) from public;

-- ---------------------------------------------------------------------------
-- montar_snapshot — ganha o passe
--
-- Repetida por inteiro, como nas rodadas anteriores: o Postgres não estende
-- função, e um wrapper sobre a versão antiga esconderia de quem lê onde o
-- payload é montado de verdade.
-- ---------------------------------------------------------------------------
create or replace function public.montar_snapshot(p_uid uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_jog           public.jogador%rowtype;
  v_fs            public.farm_state%rowtype;
  v_ass           public.assinatura%rowtype;
  v_attr          public.atributo_jogador%rowtype;
  v_assinante     boolean;
  v_tem_email     boolean;
  v_xp_base       numeric;
  v_xp_proximo    numeric;
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

  select (email is not null and email <> '') into v_tem_email
    from auth.users where id = p_uid;

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
      'diamante',           v_jog.diamante,
      'vitalidadeAtual',    v_jog.vitalidade_atual,
      'vitalidadeMaxima',   public.vitalidade_maxima(v_jog.nivel,
                                                     coalesce(v_attr.vitalidade, 0)),
      'idioma',             v_jog.idioma,
      'apelido',            v_jog.apelido,
      'temCadastro',        coalesce(v_tem_email, false),
      'identidadeVerificada', public.identidade_verificada(p_uid)
    ),
    'atributos', jsonb_build_object(
      'forca',        coalesce(v_attr.forca, 0),
      'inteligencia', coalesce(v_attr.inteligencia, 0),
      'vitalidade',   coalesce(v_attr.vitalidade, 0),
      'sorte',        coalesce(v_attr.sorte, 0),
      'pontosLivres', greatest(0, v_pontos_livres),
      'autoAlocar',   coalesce(v_attr.auto_alocar, true)
    ),
    'inventario', public.montar_inventario(p_uid),
    'lojaOuro', public.montar_loja_ouro(),
    'passe', public.montar_passe(p_uid),
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

-- ============================================================================
-- exportar_meus_dados — passa a incluir o passe
--
-- Não é detalhe: progresso de passe é dado do titular, e uma exportação que
-- esquece uma tabela nova é exatamente a forma como o direito de acesso vira
-- promessa parcial. `docs/11_SEGURANCA/dados-pessoais-lgpd.md` §2 lista o
-- inventário; toda tabela nova de dado do jogador entra aqui junto.
-- ============================================================================
create or replace function public.exportar_meus_dados()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select jsonb_build_object(
    'geradoEm', now(),
    'conta', jsonb_build_object(
      'email',           (select email from auth.users where id = v_uid),
      'dataNascimento',  j.data_nascimento,
      'criadaEm',        j.criado_em,
      'idioma',          j.idioma
    ),
    'progresso', jsonb_build_object(
      'nivel',            j.nivel,
      'xpTotal',          j.xp_total,
      'moeda',            j.moeda,
      'diamante',         j.diamante,
      'vitalidadeAtual',  j.vitalidade_atual,
      'apelido',          j.apelido
    ),
    'atributos', (
      select jsonb_build_object('forca', a.forca, 'inteligencia', a.inteligencia,
                                'vitalidade', a.vitalidade, 'sorte', a.sorte,
                                'autoAlocar', a.auto_alocar)
        from public.atributo_jogador a where a.player_id = v_uid
    ),
    'farm', (
      select jsonb_build_object('minutosAcumulados', f.minutos_acumulados,
                                'xpPendente', f.xp_pendente,
                                'moedaPendente', f.moeda_pendente,
                                'minutosAnuncioSaldo', f.minutos_anuncio_saldo,
                                'ultimaSessao', f.last_seen_at)
        from public.farm_state f where f.player_id = v_uid
    ),
    'assinatura', (
      select jsonb_build_object('status', s.status, 'expiraEm', s.expira_em)
        from public.assinatura s where s.player_id = v_uid
    ),
    -- Sem `referencia_externa`, pelo mesmo motivo da assinatura: é dado do
    -- provedor, não do titular.
    'passe', (
      select jsonb_build_object('ativo', p.ativo, 'pontos', p.pontos,
                                'tier', p.tier, 'ativadoEm', p.ativado_em)
        from public.passe_jogador p where p.player_id = v_uid
    ),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', i.tipo, 'raridade', i.raridade,
                                          'fortificacao', i.fortificacao,
                                          'slot', i.slot, 'origem', i.origem,
                                          'obtidoEm', i.obtido_em)
                       order by i.obtido_em)
        from public.item_jogador i where i.player_id = v_uid
    ), '[]'::jsonb),
    'eventos', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', e.tipo, 'dados', e.dados,
                                          'em', e.criado_em)
                       order by e.criado_em)
        from public.evento_jogo e where e.player_id = v_uid
    ), '[]'::jsonb)
  )
    into v_out
    from public.jogador j
   where j.id = v_uid;

  if v_out is null then
    raise exception 'JOGADOR_INEXISTENTE';
  end if;

  return v_out;
end;
$$;

revoke execute on function public.exportar_meus_dados() from public;
grant execute on function public.exportar_meus_dados() to authenticated;
