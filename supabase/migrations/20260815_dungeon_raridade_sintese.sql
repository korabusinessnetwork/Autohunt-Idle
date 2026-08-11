-- ============================================================================
-- Autohunt Idle — inventário com raridade, chave, mini boss, dungeon e síntese.
--
-- Implementa `specs/dungeons-loot-skins.md` (ver `specs/build-fase-3b-dungeon-raridade.md`).
--
-- ALEATORIEDADE: todo sorteio é determinístico, semeado por
-- `(player_id, contador_sorteio)`. O jogador não controla nenhum dos dois, então
-- não consegue re-rolar; e o resultado continua auditável e reproduzível, que é
-- a mesma propriedade que já vale para o cálculo de farm. Nada de `random()`.
--
-- Esta migration também FATORA o caminho de crédito num único lugar
-- (`creditar_ciclos`), para as próximas rodadas não precisarem reescrever
-- `iniciar_sessao` e `validar_lote` inteiras de novo.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- item_jogador — uma linha por item.
--
-- Não é pilha de propósito: `specs/equipamento-e-poder.md` vai acrescentar stat,
-- tipo de dano e conjunto por item, e empilhar agora obrigaria a desempilhar
-- depois.
-- ---------------------------------------------------------------------------
create table if not exists public.item_jogador (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.jogador (id) on delete cascade,

  tipo       text not null check (tipo in ('arma', 'acessorio', 'skin', 'chave')),
  -- 1 = comum … 10 = cósmico. Ver `src/game/regrasLoot.ts` para os nomes.
  raridade   smallint not null check (raridade between 1 and 10),

  equipado   boolean not null default false,
  origem     text not null check (origem in ('mundo', 'mini_boss', 'dungeon', 'sintese')),
  obtido_em  timestamptz not null default now()
);

create index if not exists item_jogador_busca_idx
  on public.item_jogador (player_id, tipo, raridade);

-- Uma skin equipada por vez. Chave e item sem efeito mecânico nunca são
-- equipados nesta fase.
create unique index if not exists item_skin_equipada_unica
  on public.item_jogador (player_id)
  where equipado and tipo = 'skin';

comment on table public.item_jogador is
  'Inventário do jogador. Escrito só por RPC SECURITY DEFINER — raridade é decidida no servidor.';

-- ---------------------------------------------------------------------------
-- Estado de sorteio e de spawn, no farm_state
-- ---------------------------------------------------------------------------
alter table public.farm_state
  add column if not exists contador_sorteio bigint not null default 0;
alter table public.farm_state
  add column if not exists ciclos_desde_mini_boss integer not null default 0;

comment on column public.farm_state.contador_sorteio is
  'Semente monotônica dos sorteios. O jogador não a controla, então não consegue re-rolar um drop.';

-- ============================================================================
-- Sorteio determinístico
-- ============================================================================
create or replace function public.sorteio01(p_semente text)
returns numeric
language sql
immutable
as $$
  select (('x' || substr(md5(p_semente), 1, 8))::bit(32)::bigint)::numeric / 4294967296.0;
$$;

/*
  Escalada de raridade — espelha `escalarRaridade` em `src/game/regrasLoot.ts`.

  Começa no piso e sobe um degrau por sorteio bem-sucedido. O PISO É GARANTIA,
  não sorteio: é o que faz o boss de dungeon cumprir o critério 11 da spec de
  origem ("mínimo raro, certeza, não só chance").
*/
create or replace function public.escalar_raridade(
  p_semente text,
  p_piso     smallint,
  p_teto     smallint,
  p_sorte    integer
)
returns smallint
language plpgsql
immutable
as $$
declare
  c_chance_base    constant numeric := 0.18;
  c_bonus_maximo   constant numeric := 0.12;
  c_sorte_por_pto  constant integer := 4000;

  v_chance numeric;
  v_piso   smallint := greatest(1, least(10, p_piso));
  v_teto   smallint;
  v_tier   smallint;
  v_i      integer := 0;
begin
  v_teto := greatest(v_piso, least(10, p_teto));
  v_chance := c_chance_base
              + least(c_bonus_maximo, greatest(0, p_sorte)::numeric / c_sorte_por_pto);

  v_tier := v_piso;
  while v_tier < v_teto loop
    exit when public.sorteio01(p_semente || ':' || v_i) >= v_chance;
    v_tier := v_tier + 1;
    v_i := v_i + 1;
  end loop;

  return v_tier;
end;
$$;

-- ============================================================================
-- Concessão de item
-- ============================================================================
create or replace function public.conceder_item(
  p_player_id uuid,
  p_tipo      text,
  p_piso      smallint,
  p_teto      smallint,
  p_origem    text,
  p_sorte     integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contador bigint;
  v_raridade smallint;
  v_id       uuid;
begin
  update public.farm_state
     set contador_sorteio = contador_sorteio + 1
   where player_id = p_player_id
  returning contador_sorteio into v_contador;

  if p_tipo = 'chave' then
    -- Chave é ingresso, não loot: nasce sempre comum, sem sorteio.
    v_raridade := 1;
  else
    v_raridade := public.escalar_raridade(
      p_player_id::text || '#' || v_contador::text, p_piso, p_teto, p_sorte
    );
  end if;

  insert into public.item_jogador (player_id, tipo, raridade, origem)
  values (p_player_id, p_tipo, v_raridade, p_origem)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.conceder_item(uuid, text, smallint, smallint, text, integer)
  from public, anon, authenticated;

-- ============================================================================
-- Drops do mundo aberto — chave e mini boss
--
-- Nota de implementação: a chance de chave por ciclo é resolvida em forma
-- fechada (`floor(ciclos * taxa)` mais um sorteio para a fração) em vez de um
-- sorteio por ciclo. O valor esperado é idêntico e evita um laço de 5760
-- iterações numa ausência de 24h. O mini boss é periódico por definição da
-- spec, então nem precisa de sorteio.
-- ============================================================================
create or replace function public.resolver_drops(
  p_player_id uuid,
  p_ciclos    integer,
  p_sorte     integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_taxa_chave_ciclo   constant numeric := 0.0015;
  c_ciclos_mini_boss   constant integer := 240;   -- ~1h de jogo
  c_teto_itens         constant integer := 40;    -- guarda contra ausência absurda

  v_fs          public.farm_state%rowtype;
  v_esperado    numeric;
  v_chaves      integer;
  v_mini_bosses integer;
  v_acumulado   integer;
  v_i           integer;
  v_itens       integer := 0;
begin
  if p_ciclos is null or p_ciclos <= 0 then
    return jsonb_build_object('chaves', 0, 'miniBosses', 0, 'itens', 0);
  end if;

  select * into v_fs from public.farm_state where player_id = p_player_id for update;

  -- Chaves do farm comum.
  v_esperado := p_ciclos * c_taxa_chave_ciclo;
  v_chaves := floor(v_esperado)::integer;
  if public.sorteio01(p_player_id::text || '|chave|' || v_fs.contador_sorteio::text)
     < (v_esperado - floor(v_esperado)) then
    v_chaves := v_chaves + 1;
  end if;

  -- Mini boss: periódico, sem chave e sem gatilho manual (critério 1b da spec
  -- de origem). O resto de ciclos fica guardado para a próxima resolução.
  v_acumulado := v_fs.ciclos_desde_mini_boss + p_ciclos;
  v_mini_bosses := v_acumulado / c_ciclos_mini_boss;

  update public.farm_state
     set ciclos_desde_mini_boss = v_acumulado % c_ciclos_mini_boss
   where player_id = p_player_id;

  for v_i in 1 .. least(v_chaves, c_teto_itens) loop
    perform public.conceder_item(p_player_id, 'chave', 1::smallint, 1::smallint, 'mundo', p_sorte);
    v_itens := v_itens + 1;
  end loop;

  for v_i in 1 .. least(v_mini_bosses, c_teto_itens) loop
    -- Fecha o ciclo mini boss → chave → dungeon → boss.
    perform public.conceder_item(p_player_id, 'chave', 1::smallint, 1::smallint,
                                 'mini_boss', p_sorte);
    -- Faixa intermediária: incomum garantido, raro no teto.
    perform public.conceder_item(
      p_player_id,
      case when public.sorteio01(p_player_id::text || '|mb|' || v_i::text) < 0.35
           then 'skin' else 'arma' end,
      2::smallint, 3::smallint, 'mini_boss', p_sorte
    );
    v_itens := v_itens + 2;
  end loop;

  return jsonb_build_object(
    'chaves', least(v_chaves, c_teto_itens) + least(v_mini_bosses, c_teto_itens),
    'miniBosses', v_mini_bosses,
    'itens', v_itens
  );
end;
$$;

revoke execute on function public.resolver_drops(uuid, integer, integer)
  from public, anon, authenticated;

-- ============================================================================
-- creditar_ciclos — caminho ÚNICO de crédito.
--
-- Fatorado aqui para que acrescentar mecânica nova (loot, e depois equipamento)
-- não obrigue a reescrever `iniciar_sessao` e `validar_lote` a cada rodada.
-- ============================================================================
create or replace function public.creditar_ciclos(
  p_player_id      uuid,
  p_ciclos         integer,
  p_multiplicador  integer,
  p_para_pendente  boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_jog         public.jogador%rowtype;
  v_attr        public.atributo_jogador%rowtype;
  v_nivel_antes bigint;
  v_xp          bigint;
  v_moeda       bigint;
  v_vitalidade  integer;
  v_perdidos    integer;
  v_drops       jsonb;
begin
  select * into v_jog  from public.jogador          where id = p_player_id;
  select * into v_attr from public.atributo_jogador where player_id = p_player_id;

  select o_xp, o_moeda, o_vitalidade, o_ciclos_perdidos
    into v_xp, v_moeda, v_vitalidade, v_perdidos
    from public.resolver_ciclos(v_jog.nivel, v_jog.vitalidade_atual, p_ciclos,
                                p_multiplicador, coalesce(v_attr.forca, 0),
                                coalesce(v_attr.inteligencia, 0),
                                coalesce(v_attr.vitalidade, 0));

  v_nivel_antes := v_jog.nivel;

  if p_para_pendente then
    -- Farm offline: XP e moeda ficam pendentes até a coleta; a Vitalidade é do
    -- personagem e vale já.
    update public.jogador
       set vitalidade_atual = v_vitalidade, atualizado_em = now()
     where id = p_player_id;

    update public.farm_state
       set xp_pendente    = xp_pendente + v_xp,
           moeda_pendente = moeda_pendente + v_moeda
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

  -- Loot acompanha os ciclos creditados, nos dois caminhos: quem não desbloqueou
  -- farm offline não roda ciclo nenhum e, portanto, não dropa nada.
  v_drops := public.resolver_drops(p_player_id, p_ciclos, coalesce(v_attr.sorte, 0));

  return jsonb_build_object(
    'xp', v_xp, 'moeda', v_moeda, 'ciclosPerdidos', v_perdidos,
    'subiuDeNivel', v_jog.nivel > v_nivel_antes, 'drops', v_drops
  );
end;
$$;

revoke execute on function public.creditar_ciclos(uuid, integer, integer, boolean)
  from public, anon, authenticated;

-- ============================================================================
-- Dungeon
--
-- Resolvida pela mesma lógica de stat-tick do mundo aberto: não exige presença
-- nem habilidade (critério 3 da spec de origem). Derrota nunca custa progresso
-- nem personagem (critério 5) — no pior caso, a chave foi gasta.
-- ============================================================================
create or replace function public.resolver_uma_dungeon(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chave      uuid;
  v_jog        public.jogador%rowtype;
  v_attr       public.atributo_jogador%rowtype;
  v_poder      numeric;
  v_poder_boss numeric;
  v_venceu     boolean;
  v_piso       smallint;
  v_teto       smallint;
begin
  -- Consome a chave primeiro: ela é o ingresso, não a garantia de loot bom
  -- (edge case explícito da spec de origem).
  delete from public.item_jogador
   where id = (
     select id from public.item_jogador
      where player_id = p_player_id and tipo = 'chave'
      order by obtido_em
      limit 1
      for update skip locked
   )
  returning id into v_chave;

  if v_chave is null then
    return jsonb_build_object('resolvida', false, 'motivo', 'SEM_CHAVE');
  end if;

  select * into v_jog  from public.jogador          where id = p_player_id;
  select * into v_attr from public.atributo_jogador where player_id = p_player_id;

  -- Sem aleatoriedade: perder é sinal de que falta nível, não azar.
  v_poder := 10 + v_jog.nivel + coalesce(v_attr.forca, 0)
             + coalesce(v_attr.inteligencia, 0) + coalesce(v_attr.vitalidade, 0);
  v_poder_boss := 10 + v_jog.nivel * 1.2;
  v_venceu := v_poder >= v_poder_boss;

  if v_venceu then
    v_piso := 3;   -- raro garantido
    v_teto := 10;
  else
    v_piso := 1;
    v_teto := 3;
  end if;

  perform public.conceder_item(
    p_player_id,
    case when public.sorteio01(p_player_id::text || '|dg|' || v_chave::text) < 0.3
         then 'skin' else 'arma' end,
    v_piso, v_teto, 'dungeon', coalesce(v_attr.sorte, 0)
  );

  return jsonb_build_object('resolvida', true, 'venceu', v_venceu);
end;
$$;

revoke execute on function public.resolver_uma_dungeon(uuid) from public, anon, authenticated;

/** Resolve várias dungeons de uma vez, respeitando o teto por retorno. */
create or replace function public.resolver_dungeons(p_player_id uuid, p_teto integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_i          integer;
  v_resultado  jsonb;
  v_resolvidas integer := 0;
  v_vitorias   integer := 0;
begin
  for v_i in 1 .. greatest(0, p_teto) loop
    v_resultado := public.resolver_uma_dungeon(p_player_id);
    exit when not (v_resultado ->> 'resolvida')::boolean;
    v_resolvidas := v_resolvidas + 1;
    if (v_resultado ->> 'venceu')::boolean then
      v_vitorias := v_vitorias + 1;
    end if;
  end loop;

  return jsonb_build_object('resolvidas', v_resolvidas, 'vitorias', v_vitorias);
end;
$$;

revoke execute on function public.resolver_dungeons(uuid, integer) from public, anon, authenticated;

/** Dungeon pedida pelo jogador durante a sessão ao vivo. Sem parâmetro. */
create or replace function public.iniciar_dungeon()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_res jsonb;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  v_res := public.resolver_uma_dungeon(v_uid);

  if (v_res ->> 'resolvida')::boolean then
    insert into public.evento_jogo (player_id, tipo, dados)
    values (v_uid, 'dungeon.resolvida', v_res);
  end if;

  return public.montar_snapshot(v_uid) || jsonb_build_object('dungeon', v_res);
end;
$$;

-- ============================================================================
-- Síntese — 9 iguais viram 1 do tier seguinte.
--
-- Caminho de progressão determinístico para quem farma muito, sem depender de
-- sorte de drop nem de diamante (critérios 12 e 13 da spec de origem).
-- ============================================================================
create or replace function public.sintetizar(p_tipo text, p_raridade smallint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_itens_por_sintese constant integer := 9;
  c_chance_pular      constant numeric := 0.08;

  v_uid       uuid := auth.uid();
  v_consumido integer;
  v_contador  bigint;
  v_produz    smallint;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  if p_tipo not in ('arma', 'acessorio', 'skin') then
    raise exception 'TIPO_INVALIDO';
  end if;

  if p_raridade is null or p_raridade < 1 or p_raridade >= 10 then
    raise exception 'TIER_MAXIMO';
  end if;

  -- Consumo e criação na mesma transação: nunca some item sem gerar, nem gera
  -- sem consumir. `skip locked` faz duas sínteses simultâneas não brigarem pelo
  -- mesmo item.
  with escolhidos as (
    select id from public.item_jogador
     where player_id = v_uid and tipo = p_tipo and raridade = p_raridade
     order by equipado, obtido_em
     limit c_itens_por_sintese
     for update skip locked
  )
  delete from public.item_jogador
   where id in (select id from escolhidos);

  get diagnostics v_consumido = row_count;

  if v_consumido < c_itens_por_sintese then
    -- Nada foi apagado de fato: a transação inteira volta atrás.
    raise exception 'ITENS_INSUFICIENTES';
  end if;

  update public.farm_state
     set contador_sorteio = contador_sorteio + 1
   where player_id = v_uid
  returning contador_sorteio into v_contador;

  v_produz := least(
    10,
    p_raridade + case
      when public.sorteio01(v_uid::text || '|sint|' || v_contador::text) < c_chance_pular
      then 2 else 1 end
  );

  insert into public.item_jogador (player_id, tipo, raridade, origem)
  values (v_uid, p_tipo, v_produz, 'sintese');

  insert into public.evento_jogo (player_id, tipo, dados)
  values (v_uid, 'item.sintetizado',
          jsonb_build_object('tipo', p_tipo, 'de', p_raridade, 'para', v_produz));

  return public.montar_snapshot(v_uid)
         || jsonb_build_object('sintese', jsonb_build_object(
              'consumidos', v_consumido, 'produziuRaridade', v_produz));
end;
$$;

-- ============================================================================
-- Skin — puramente cosmética.
--
-- Repare que NENHUMA função de recompensa consulta skin: `resolver_ciclos` não
-- recebe nem lê a skin equipada, e `resolver_uma_dungeon` também não. É assim
-- que o critério 8 da spec de origem ("dano, hitbox e stat idênticos com
-- qualquer skin") deixa de ser promessa e vira propriedade estrutural.
-- ============================================================================
create or replace function public.equipar_skin(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_tipo text;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select tipo into v_tipo
    from public.item_jogador
   where id = p_item_id and player_id = v_uid;

  if v_tipo is null then
    raise exception 'ITEM_INEXISTENTE';
  end if;
  if v_tipo <> 'skin' then
    raise exception 'ITEM_NAO_E_SKIN';
  end if;

  update public.item_jogador set equipado = false
   where player_id = v_uid and tipo = 'skin' and equipado;

  update public.item_jogador set equipado = true where id = p_item_id;

  return public.montar_snapshot(v_uid);
end;
$$;

-- ============================================================================
-- Snapshot — ganha o resumo do inventário
-- ============================================================================
create or replace function public.montar_inventario(p_uid uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'chaves', (select count(*) from public.item_jogador
                where player_id = p_uid and tipo = 'chave'),
    'skinEquipada', (select id from public.item_jogador
                      where player_id = p_uid and tipo = 'skin' and equipado),
    -- Lista individual só das skins: são os únicos itens equipáveis nesta fase,
    -- e equipar precisa de um id. Arma e acessório viram lista quando ganharem
    -- stat próprio (`specs/equipamento-e-poder.md`).
    'skins', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'raridade', raridade,
                                          'equipada', equipado)
                       order by raridade desc, obtido_em)
        from public.item_jogador
       where player_id = p_uid and tipo = 'skin'
    ), '[]'::jsonb),
    'porTipoERaridade', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', tipo, 'raridade', raridade,
                                          'quantidade', quantidade)
                       order by tipo, raridade)
        from (
          select tipo, raridade, count(*) as quantidade
            from public.item_jogador
           where player_id = p_uid and tipo <> 'chave'
           group by tipo, raridade
        ) as agrupado
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.montar_inventario(uuid) from public;

-- ============================================================================
-- RLS e permissões
-- ============================================================================
alter table public.item_jogador enable row level security;

drop policy if exists item_le_proprio on public.item_jogador;
create policy item_le_proprio on public.item_jogador
  for select using (auth.uid() = player_id);

revoke all on public.item_jogador from anon, authenticated;
grant select on public.item_jogador to authenticated;

revoke execute on function public.iniciar_dungeon()              from public;
revoke execute on function public.sintetizar(text, smallint)     from public;
revoke execute on function public.equipar_skin(uuid)             from public;

grant execute on function public.iniciar_dungeon()          to authenticated;
grant execute on function public.sintetizar(text, smallint) to authenticated;
grant execute on function public.equipar_skin(uuid)         to authenticated;
