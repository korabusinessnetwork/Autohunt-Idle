-- ============================================================================
-- Autohunt Idle — fortificação de item.
--
-- Implementa `specs/fortificacao-de-item.md` (ver `specs/build-fase-3e-fortificacao.md`).
--
-- DUAS REGRAS DE PRODUTO QUE ESTE ARQUIVO PRECISA HONRAR, E QUE NÃO SÃO
-- PREFERÊNCIA DE DESIGN:
--
-- 1. Fortificar custa OURO — a moeda ganha jogando — e pedras que só caem
--    jogando. NENHUMA rota vende pedra, por moeda nenhuma. A loja que vende
--    ouro por diamante entra quando o diamante existir, e entrega quantidade
--    fixa: a compra nunca é o sorteio. É isso que separa esta mecânica de uma
--    recompensa aleatória paga (`memory/restrictions.md`, restrição CRÍTICA).
--
-- 2. FALHAR NÃO REBAIXA NEM DESTRÓI O ITEM. Repare que não existe, em nenhum
--    lugar deste arquivo, um caminho que decremente `fortificacao`. O princípio
--    "progresso nunca é punido" (`memory/identity.md`) — o mesmo que já custou
--    o permadeath ao projeto — segue valendo sem exceção.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Nível de fortificação e os três tipos de pedra
-- ---------------------------------------------------------------------------
alter table public.item_jogador
  add column if not exists fortificacao smallint not null default 0
    check (fortificacao between 0 and 15);

alter table public.item_jogador drop constraint if exists item_jogador_tipo_check;
alter table public.item_jogador add constraint item_jogador_tipo_check
  check (tipo in ('arma', 'capacete', 'armadura', 'luva', 'bota', 'acessorio',
                  'skin', 'chave',
                  'pedra_fortificacao', 'pedra_sorte', 'pedra_garantia'));

comment on column public.item_jogador.fortificacao is
  'Nível de fortificação, de +0 a +15. Nunca decresce: falhar consome o material e deixa o item como estava.';

-- ---------------------------------------------------------------------------
-- Matemática (espelha src/game/regrasFortificacao.ts)
-- ---------------------------------------------------------------------------
create or replace function public.chance_de_fortificar(
  p_nivel_atual integer,
  p_com_sorte   boolean default false
)
returns numeric
language sql
immutable
as $$
  select least(0.95,
    case when p_com_sorte then 0.15 else 0 end
    + greatest(0.05, 0.95 - greatest(0, p_nivel_atual) * 0.075)
  );
$$;

create or replace function public.custo_de_fortificar(
  p_nivel_atual integer,
  p_raridade    integer
)
returns bigint
language sql
immutable
as $$
  select floor(
    50 * power(greatest(0, p_nivel_atual) + 1, 2)
       * (1 + least(10, greatest(1, p_raridade))::numeric / 5)
  )::bigint;
$$;

/** Multiplicador que a fortificação aplica ao stat do item. */
create or replace function public.bonus_de_fortificacao(p_nivel integer)
returns numeric
language sql
immutable
as $$
  select 1 + least(15, greatest(0, p_nivel))::numeric * 0.08;
$$;

-- ---------------------------------------------------------------------------
-- poder_do_item — agora considera a fortificação
-- ---------------------------------------------------------------------------
create or replace function public.poder_do_item(
  p_raridade     integer,
  p_fortificacao integer default 0
)
returns integer
language sql
immutable
as $$
  select floor(
    (least(10, greatest(0, p_raridade)) ^ 2 + least(10, greatest(0, p_raridade)) * 3)
    * public.bonus_de_fortificacao(p_fortificacao)
  )::integer;
$$;

-- ---------------------------------------------------------------------------
-- poder_de_ataque — passa a fortificação de cada peça
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
    v_poder_arma := public.poder_do_item(v_arma.raridade, v_arma.fortificacao);
  end if;

  for v_peca in
    select * from public.item_jogador
     where player_id = p_player_id
       and slot = any (public.slots_de_poder())
       and slot <> 'arma'
  loop
    if v_peca.afinidade is not null and v_peca.afinidade = v_tipo_dano then
      v_poder_peca := v_poder_peca
                      + public.poder_do_item(v_peca.raridade, v_peca.fortificacao)
                        * (1 + c_sinergia);
    else
      v_poder_peca := v_poder_peca + public.poder_do_item(v_peca.raridade, v_peca.fortificacao);
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

-- ============================================================================
-- fortificar_item
--
-- Os parâmetros são escolhas do jogador — qual item, e se quer gastar as pedras
-- opcionais. Nenhum deles informa resultado, custo ou chance: tudo isso é
-- decidido aqui.
-- ============================================================================
create or replace function public.fortificar_item(
  p_item_id       uuid,
  p_usar_sorte    boolean default false,
  p_usar_garantia boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_teto constant integer := 15;

  v_uid       uuid := auth.uid();
  v_item      public.item_jogador%rowtype;
  v_jog       public.jogador%rowtype;
  v_custo     bigint;
  v_chance    numeric;
  v_contador  bigint;
  v_sucesso   boolean;
  v_pedra     uuid;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select * into v_item
    from public.item_jogador
   where id = p_item_id and player_id = v_uid
   for update;

  if v_item.id is null then
    raise exception 'ITEM_INEXISTENTE';
  end if;

  -- Skin não tem stat, então fortificá-la não faria nada; chave e pedra não são
  -- equipamento.
  if not (v_item.tipo = any (public.slots_de_poder())) then
    raise exception 'ITEM_NAO_FORTIFICAVEL';
  end if;

  if v_item.fortificacao >= c_teto then
    raise exception 'TETO_ATINGIDO';
  end if;

  v_custo := public.custo_de_fortificar(v_item.fortificacao, v_item.raridade);

  select * into v_jog from public.jogador where id = v_uid for update;
  if v_jog.moeda < v_custo then
    raise exception 'OURO_INSUFICIENTE';
  end if;

  -- Consome as pedras. Cada `delete ... returning` que não achar linha derruba
  -- a transação inteira antes de qualquer cobrança — é o critério 10: faltando
  -- material, nada é consumido.
  delete from public.item_jogador
   where id = (select id from public.item_jogador
                where player_id = v_uid and tipo = 'pedra_fortificacao'
                order by obtido_em limit 1 for update skip locked)
  returning id into v_pedra;

  if v_pedra is null then
    raise exception 'SEM_PEDRA';
  end if;

  if p_usar_sorte then
    delete from public.item_jogador
     where id = (select id from public.item_jogador
                  where player_id = v_uid and tipo = 'pedra_sorte'
                  order by obtido_em limit 1 for update skip locked)
    returning id into v_pedra;
    if v_pedra is null then
      raise exception 'SEM_PEDRA';
    end if;
  end if;

  if p_usar_garantia then
    delete from public.item_jogador
     where id = (select id from public.item_jogador
                  where player_id = v_uid and tipo = 'pedra_garantia'
                  order by obtido_em limit 1 for update skip locked)
    returning id into v_pedra;
    if v_pedra is null then
      raise exception 'SEM_PEDRA';
    end if;
  end if;

  -- Ouro sai com ou sem sucesso.
  update public.jogador
     set moeda = moeda - v_custo, atualizado_em = now()
   where id = v_uid;

  v_chance := case when p_usar_garantia
                   then 1
                   else public.chance_de_fortificar(v_item.fortificacao, p_usar_sorte) end;

  update public.farm_state
     set contador_sorteio = contador_sorteio + 1
   where player_id = v_uid
  returning contador_sorteio into v_contador;

  v_sucesso := public.sorteio01(v_uid::text || '|fort|' || v_contador::text) < v_chance;

  -- Só o caminho de SUCESSO escreve `fortificacao`. Falhar não tem update
  -- nenhum aqui — é por isso que o item nunca é rebaixado.
  if v_sucesso then
    update public.item_jogador
       set fortificacao = fortificacao + 1
     where id = p_item_id;
  end if;

  insert into public.evento_jogo (player_id, tipo, dados)
  values (v_uid, 'item.fortificado',
          jsonb_build_object('itemId', p_item_id, 'de', v_item.fortificacao,
                             'sucesso', v_sucesso, 'custo', v_custo));

  return public.montar_snapshot(v_uid) || jsonb_build_object(
    'fortificacao', jsonb_build_object(
      'sucesso',     v_sucesso,
      'nivelFinal',  v_item.fortificacao + case when v_sucesso then 1 else 0 end,
      'custoPago',   v_custo,
      'chanceUsada', v_chance
    )
  );
end;
$$;

revoke execute on function public.fortificar_item(uuid, boolean, boolean) from public;
grant execute on function public.fortificar_item(uuid, boolean, boolean) to authenticated;

-- ============================================================================
-- Pedras entram no loot — e SÓ no loot.
--
-- Não existe, em lugar nenhum do schema, uma rota que venda pedra. Se algum dia
-- existir uma loja, esta é a linha que precisa continuar sendo a única fonte.
-- ============================================================================
create or replace function public.sortear_pedra(p_semente text)
returns text
language sql
immutable
as $$
  -- Fortificação é a comum; Sorte é ocasional; Garantia é a rara das três.
  select case
    when public.sorteio01(p_semente) < 0.70 then 'pedra_fortificacao'
    when public.sorteio01(p_semente) < 0.93 then 'pedra_sorte'
    else 'pedra_garantia'
  end;
$$;

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
  c_taxa_pedra_ciclo constant numeric := 0.0040;
  c_ciclos_mini_boss constant integer := 240;
  c_teto_itens       constant integer := 40;

  v_fs          public.farm_state%rowtype;
  v_esperado    numeric;
  v_chaves      integer;
  v_pedras      integer;
  v_mini_bosses integer;
  v_acumulado   integer;
  v_i           integer;
  v_itens       integer := 0;
begin
  if p_ciclos is null or p_ciclos <= 0 then
    return jsonb_build_object('chaves', 0, 'pedras', 0, 'miniBosses', 0, 'itens', 0);
  end if;

  select * into v_fs from public.farm_state where player_id = p_player_id for update;

  v_esperado := p_ciclos * c_taxa_chave_ciclo;
  v_chaves := floor(v_esperado)::integer;
  if public.sorteio01(p_player_id::text || '|chave|' || v_fs.contador_sorteio::text)
     < (v_esperado - floor(v_esperado)) then
    v_chaves := v_chaves + 1;
  end if;

  v_esperado := p_ciclos * c_taxa_pedra_ciclo;
  v_pedras := floor(v_esperado)::integer;
  if public.sorteio01(p_player_id::text || '|pedra|' || v_fs.contador_sorteio::text)
     < (v_esperado - floor(v_esperado)) then
    v_pedras := v_pedras + 1;
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

  for v_i in 1 .. least(v_pedras, c_teto_itens) loop
    perform public.conceder_item(
      p_player_id,
      public.sortear_pedra(p_player_id::text || '|qualpedra|' || v_fs.contador_sorteio || v_i),
      1::smallint, 1::smallint, 'mundo', p_sorte
    );
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
    'pedras', least(v_pedras, c_teto_itens),
    'miniBosses', v_mini_bosses,
    'itens', v_itens
  );
end;
$$;

revoke execute on function public.resolver_drops(uuid, integer, integer)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- conceder_item — pedra nasce sempre comum, como a chave
-- ---------------------------------------------------------------------------
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

  if v_tipo = 'equipamento' then
    v_tipo := public.sortear_tipo_equipamento(v_semente || ':parte');
  end if;

  -- Chave e pedra são consumíveis, não loot: nascem comuns, sem sorteio.
  if v_tipo = 'chave' or v_tipo like 'pedra\_%' then
    v_raridade := 1;
  else
    v_raridade := public.escalar_raridade(v_semente, p_piso, p_teto, p_sorte);
  end if;

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
-- Inventário — expõe fortificação, pedras e o custo/chance da próxima tentativa
-- ---------------------------------------------------------------------------
create or replace function public.montar_inventario(p_uid uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'chaves', (select count(*) from public.item_jogador
                where player_id = p_uid and tipo = 'chave'),
    'pedras', jsonb_build_object(
      'fortificacao', (select count(*) from public.item_jogador
                        where player_id = p_uid and tipo = 'pedra_fortificacao'),
      'sorte',        (select count(*) from public.item_jogador
                        where player_id = p_uid and tipo = 'pedra_sorte'),
      'garantia',     (select count(*) from public.item_jogador
                        where player_id = p_uid and tipo = 'pedra_garantia')
    ),
    'poderDeAtaque', public.poder_de_ataque(p_uid),
    'loadout', coalesce((
      select jsonb_object_agg(slot, jsonb_build_object(
               'id', id, 'tipo', tipo, 'raridade', raridade, 'fortificacao', fortificacao,
               'tipoDano', tipo_dano, 'afinidade', afinidade, 'conjuntoId', conjunto_id))
        from public.item_jogador
       where player_id = p_uid and slot is not null
    ), '{}'::jsonb),
    'equipaveis', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', id, 'tipo', tipo, 'raridade', raridade, 'slot', slot,
               'fortificacao', fortificacao,
               'tipoDano', tipo_dano, 'afinidade', afinidade, 'conjuntoId', conjunto_id)
             order by raridade desc, fortificacao desc, obtido_em)
        from public.item_jogador
       where player_id = p_uid
         and (tipo = any (public.slots_de_poder()) or tipo = 'skin')
    ), '[]'::jsonb),
    'porTipoERaridade', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', tipo, 'raridade', raridade,
                                          'quantidade', quantidade)
                       order by tipo, raridade)
        from (
          select tipo, raridade, count(*) as quantidade
            from public.item_jogador
           where player_id = p_uid and tipo <> 'chave' and tipo not like 'pedra\_%'
           group by tipo, raridade
        ) as agrupado
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.montar_inventario(uuid) from public;
