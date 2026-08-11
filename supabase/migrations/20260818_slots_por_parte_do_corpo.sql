-- ============================================================================
-- Autohunt Idle — equipamento por parte do corpo.
--
-- Decisão do dono (2026-08-11): a estrutura de itens passa a ser a clássica do
-- gênero — arma, capacete, armadura, luva, bota e acessório —, em vez de
-- 1 arma + 2 acessórios genéricos.
--
-- Reverte a exclusão "mais de 4 tipos de item" de `specs/equipamento-e-poder.md`.
-- Ver `specs/build-fase-3d-slots-por-parte.md` para as consequências assumidas.
--
-- SIMPLIFICAÇÃO QUE VEM DE BRINDE: como cada tipo de item corresponde a
-- exatamente um slot, `equipar_item` perde o parâmetro de slot — o servidor
-- deriva do tipo. Menos superfície exposta, menos como errar.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tipos e slots novos
-- ---------------------------------------------------------------------------
alter table public.item_jogador drop constraint if exists item_jogador_tipo_check;
alter table public.item_jogador add constraint item_jogador_tipo_check
  check (tipo in ('arma', 'capacete', 'armadura', 'luva', 'bota', 'acessorio',
                  'skin', 'chave'));

alter table public.item_jogador drop constraint if exists item_jogador_slot_check;
alter table public.item_jogador add constraint item_jogador_slot_check
  check (slot in ('arma', 'capacete', 'armadura', 'luva', 'bota', 'acessorio', 'skin'));

-- Os acessórios genéricos da rodada anterior viram o slot único de acessório.
update public.item_jogador set slot = 'acessorio' where slot in ('acessorio1', 'acessorio2');

/** Os seis slots que contribuem para o poder. `skin` NÃO está aqui. */
create or replace function public.slots_de_poder()
returns text[]
language sql
immutable
as $$
  select array['arma', 'capacete', 'armadura', 'luva', 'bota', 'acessorio'];
$$;

-- ---------------------------------------------------------------------------
-- Poder de ataque — agora percorre as seis partes
-- ---------------------------------------------------------------------------
create or replace function public.poder_de_ataque(p_player_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  c_sinergia   constant numeric := 0.20;
  -- Cada degrau vale mais que o dobro do anterior: 0.20 > 2×0.08 e
  -- 0.45 > 2×0.20. É o critério 16 da spec de origem, generalizado para seis
  -- slots.
  c_conjunto_2 constant numeric := 0.08;
  c_conjunto_4 constant numeric := 0.20;
  c_conjunto_6 constant numeric := 0.45;

  v_attr       public.atributo_jogador%rowtype;
  v_arma       public.item_jogador%rowtype;
  v_tipo_dano  text;
  v_poder_arma numeric := 0;
  v_poder_peca numeric := 0;
  v_principal  integer;
  v_secundario integer;
  v_pecas      integer;
  v_mult       numeric := 1;
  v_peca       public.item_jogador%rowtype;
begin
  select * into v_attr from public.atributo_jogador where player_id = p_player_id;

  select * into v_arma
    from public.item_jogador
   where player_id = p_player_id and slot = 'arma';

  v_tipo_dano := coalesce(v_arma.tipo_dano, 'fisico');

  if v_arma.id is not null then
    v_poder_arma := public.poder_do_item(v_arma.raridade);
  end if;

  -- Todas as peças de poder menos a arma. O slot `skin` jamais entra nesta
  -- consulta, e é isso que faz "skin nunca tem stat" ser estrutural.
  for v_peca in
    select * from public.item_jogador
     where player_id = p_player_id
       and slot = any (public.slots_de_poder())
       and slot <> 'arma'
  loop
    if v_peca.afinidade is not null and v_peca.afinidade = v_tipo_dano then
      v_poder_peca := v_poder_peca + public.poder_do_item(v_peca.raridade) * (1 + c_sinergia);
    else
      v_poder_peca := v_poder_peca + public.poder_do_item(v_peca.raridade);
    end if;
  end loop;

  if v_tipo_dano = 'fisico' then
    v_principal  := coalesce(v_attr.forca, 0);
    v_secundario := coalesce(v_attr.inteligencia, 0);
  else
    v_principal  := coalesce(v_attr.inteligencia, 0);
    v_secundario := coalesce(v_attr.forca, 0);
  end if;

  select coalesce(max(quantidade), 0) into v_pecas
    from (
      select count(*) as quantidade
        from public.item_jogador
       where player_id = p_player_id
         and slot = any (public.slots_de_poder())
         and conjunto_id is not null
       group by conjunto_id
    ) as agrupado;

  if v_pecas >= 6 then
    v_mult := 1 + c_conjunto_6;
  elsif v_pecas >= 4 then
    v_mult := 1 + c_conjunto_4;
  elsif v_pecas >= 2 then
    v_mult := 1 + c_conjunto_2;
  end if;

  return floor((v_poder_arma + v_poder_peca + v_principal + (v_secundario / 2)) * v_mult)::integer;
end;
$$;

revoke execute on function public.poder_de_ataque(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- conceder_item — o drop se espalha pelas seis partes
-- ---------------------------------------------------------------------------
create or replace function public.sortear_tipo_equipamento(p_semente text)
returns text
language sql
immutable
as $$
  select (public.slots_de_poder())[
    1 + floor(public.sorteio01(p_semente) * array_length(public.slots_de_poder(), 1))::integer
  ];
$$;

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
  v_contador  bigint;
  v_raridade  smallint;
  v_semente   text;
  v_tipo      text := p_tipo;
  v_tipo_dano text := null;
  v_afinidade text := null;
  v_conjunto  text := null;
  v_lista     text[];
  v_id        uuid;
begin
  update public.farm_state
     set contador_sorteio = contador_sorteio + 1
   where player_id = p_player_id
  returning contador_sorteio into v_contador;

  v_semente := p_player_id::text || '#' || v_contador::text;

  -- 'equipamento' é um pedido genérico: o servidor escolhe qual das seis partes
  -- caiu. Quem pede tipo específico (chave, skin) continua recebendo aquele.
  if v_tipo = 'equipamento' then
    v_tipo := public.sortear_tipo_equipamento(v_semente || ':parte');
  end if;

  if v_tipo = 'chave' then
    v_raridade := 1;
  else
    v_raridade := public.escalar_raridade(v_semente, p_piso, p_teto, p_sorte);
  end if;

  -- Conjunto só a partir de épico. Sorteado antes do tipo de dano porque,
  -- quando existe, é ele que decide o tema (critério 17 da spec de origem).
  if v_tipo = any (public.slots_de_poder()) and v_raridade >= 4 then
    if public.sorteio01(v_semente || ':conj') < 0.5 then
      v_lista := public.conjuntos_disponiveis();
      v_conjunto := v_lista[1 + floor(public.sorteio01(v_semente || ':qual')
                                      * array_length(v_lista, 1))::integer];
    end if;
  end if;

  if v_tipo = 'arma' then
    v_tipo_dano := coalesce(
      public.tipo_dano_do_conjunto(v_conjunto),
      case when public.sorteio01(v_semente || ':dano') < 0.5 then 'fisico' else 'magico' end
    );
  elsif v_tipo = any (public.slots_de_poder()) then
    -- Afinidade agora vale em qualquer peça que não seja a arma: com seis
    -- slots, mantê-la exclusiva do acessório faria cinco deles serem só um
    -- número somado (decisão D2 do spec de build).
    if v_conjunto is not null then
      v_afinidade := public.tipo_dano_do_conjunto(v_conjunto);
    elsif public.sorteio01(v_semente || ':afin') < 0.6 then
      v_afinidade := case when public.sorteio01(v_semente || ':afin2') < 0.5
                          then 'fisico' else 'magico' end;
    end if;
  end if;

  insert into public.item_jogador (player_id, tipo, raridade, origem,
                                   tipo_dano, afinidade, conjunto_id)
  values (p_player_id, v_tipo, v_raridade, p_origem, v_tipo_dano, v_afinidade, v_conjunto)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.conceder_item(uuid, text, smallint, smallint, text, integer)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Drops passam a pedir 'equipamento' em vez de 'arma'
-- ---------------------------------------------------------------------------
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
  c_taxa_chave_ciclo constant numeric := 0.0015;
  c_ciclos_mini_boss constant integer := 240;
  c_teto_itens       constant integer := 40;

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

  v_esperado := p_ciclos * c_taxa_chave_ciclo;
  v_chaves := floor(v_esperado)::integer;
  if public.sorteio01(p_player_id::text || '|chave|' || v_fs.contador_sorteio::text)
     < (v_esperado - floor(v_esperado)) then
    v_chaves := v_chaves + 1;
  end if;

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
    perform public.conceder_item(p_player_id, 'chave', 1::smallint, 1::smallint,
                                 'mini_boss', p_sorte);
    perform public.conceder_item(
      p_player_id,
      case when public.sorteio01(p_player_id::text || '|mb|' || v_i::text) < 0.25
           then 'skin' else 'equipamento' end,
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

-- ---------------------------------------------------------------------------
-- Dungeon — mesmo ajuste no tipo do loot
-- ---------------------------------------------------------------------------
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

  -- Sem aleatoriedade: perder é sinal de que falta poder, não azar.
  v_poder := 10 + public.poder_de_ataque(p_player_id);
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
    case when public.sorteio01(p_player_id::text || '|dg|' || v_chave::text) < 0.25
         then 'skin' else 'equipamento' end,
    v_piso, v_teto, 'dungeon', coalesce(v_attr.sorte, 0)
  );

  return jsonb_build_object('resolvida', true, 'venceu', v_venceu);
end;
$$;

revoke execute on function public.resolver_uma_dungeon(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- equipar_item — perde o parâmetro de slot: o tipo do item já o determina
-- ---------------------------------------------------------------------------
drop function if exists public.equipar_item(uuid, text);

create or replace function public.equipar_item(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_item public.item_jogador%rowtype;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  -- Posse conferida no servidor: o client manda um id, não uma afirmação sobre
  -- o que ele é nem sobre onde vai.
  select * into v_item
    from public.item_jogador
   where id = p_item_id and player_id = v_uid;

  if v_item.id is null then
    raise exception 'ITEM_INEXISTENTE';
  end if;

  if v_item.tipo = 'chave' then
    raise exception 'ITEM_NAO_EQUIPAVEL';
  end if;

  -- Troca livre, sem cooldown e sem custo.
  update public.item_jogador set slot = null
   where player_id = v_uid and slot = v_item.tipo;

  update public.item_jogador set slot = v_item.tipo where id = p_item_id;

  return public.montar_snapshot(v_uid);
end;
$$;

revoke execute on function public.equipar_item(uuid) from public;
grant execute on function public.equipar_item(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Síntese aceita os tipos novos
-- ---------------------------------------------------------------------------
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

  if p_tipo <> 'skin' and not (p_tipo = any (public.slots_de_poder())) then
    raise exception 'TIPO_INVALIDO';
  end if;

  if p_raridade is null or p_raridade < 1 or p_raridade >= 10 then
    raise exception 'TIER_MAXIMO';
  end if;

  with escolhidos as (
    select id from public.item_jogador
     where player_id = v_uid and tipo = p_tipo and raridade = p_raridade
     order by slot nulls first, obtido_em
     limit c_itens_por_sintese
     for update skip locked
  )
  delete from public.item_jogador where id in (select id from escolhidos);

  get diagnostics v_consumido = row_count;

  if v_consumido < c_itens_por_sintese then
    raise exception 'ITENS_INSUFICIENTES';
  end if;

  update public.farm_state
     set contador_sorteio = contador_sorteio + 1
   where player_id = v_uid
  returning contador_sorteio into v_contador;

  v_produz := least(10, p_raridade + case
    when public.sorteio01(v_uid::text || '|sint|' || v_contador::text) < c_chance_pular
    then 2 else 1 end);

  insert into public.item_jogador (player_id, tipo, raridade, origem)
  values (v_uid, p_tipo, v_produz, 'sintese');

  perform public.garantir_arma_inicial(v_uid);

  insert into public.evento_jogo (player_id, tipo, dados)
  values (v_uid, 'item.sintetizado',
          jsonb_build_object('tipo', p_tipo, 'de', p_raridade, 'para', v_produz));

  return public.montar_snapshot(v_uid)
         || jsonb_build_object('sintese', jsonb_build_object(
              'consumidos', v_consumido, 'produziuRaridade', v_produz));
end;
$$;
