-- ============================================================================
-- Autohunt Idle — equipamento, sinergia de afinidade e conjunto.
--
-- Implementa `specs/equipamento-e-poder.md` (ver `specs/build-fase-3c-equipamento.md`).
--
-- NÃO EXISTE CLASSE em lugar nenhum deste arquivo — nem coluna, nem parâmetro,
-- nem enum. A variedade vem do loot: "build de mago" é o que emerge de varinha
-- mais acessórios mágicos, e some no instante em que o jogador troca de arma.
--
-- Espelhado em `src/game/regrasEquipamento.ts`, que tem os testes da regra.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Colunas novas do item
-- ---------------------------------------------------------------------------
alter table public.item_jogador
  add column if not exists tipo_dano   text check (tipo_dano in ('fisico', 'magico'));
alter table public.item_jogador
  add column if not exists afinidade   text check (afinidade in ('fisico', 'magico'));
alter table public.item_jogador
  add column if not exists conjunto_id text;

-- Slot substitui o booleano `equipado`: um booleano não sabe distinguir dois
-- acessórios nem impedir um terceiro.
alter table public.item_jogador
  add column if not exists slot text
    check (slot in ('arma', 'acessorio1', 'acessorio2', 'skin'));

drop index if exists public.item_skin_equipada_unica;

update public.item_jogador set slot = 'skin' where equipado and tipo = 'skin' and slot is null;

alter table public.item_jogador drop column if exists equipado;

-- Um item por slot, por jogador. É o que garante os 3 slots do critério 3 sem
-- depender de a aplicação lembrar de conferir.
create unique index if not exists item_slot_unico
  on public.item_jogador (player_id, slot)
  where slot is not null;

comment on column public.item_jogador.slot is
  'Slot ocupado: arma, acessorio1, acessorio2 ou skin. Nulo = guardado. O índice único é quem impede um quarto equipado.';

-- ---------------------------------------------------------------------------
-- Conjuntos — só item épico (5) ou superior pertence a um (critério 14)
-- ---------------------------------------------------------------------------
create or replace function public.conjuntos_disponiveis()
returns text[]
language sql
immutable
as $$
  select array['bruxa-caramelo', 'cavaleiro-biscoito', 'feiticeira-menta', 'brutamontes-nougat'];
$$;

/** Tipo de dano temático de cada conjunto (critério 17 da spec de origem). */
create or replace function public.tipo_dano_do_conjunto(p_conjunto text)
returns text
language sql
immutable
as $$
  select case p_conjunto
    when 'bruxa-caramelo'     then 'magico'
    when 'feiticeira-menta'   then 'magico'
    when 'cavaleiro-biscoito' then 'fisico'
    when 'brutamontes-nougat' then 'fisico'
    else null
  end;
$$;

-- ============================================================================
-- Poder
-- ============================================================================
create or replace function public.poder_do_item(p_raridade integer)
returns integer
language sql
immutable
as $$
  -- Cresce mais que linear: cósmico precisa parecer cósmico.
  select (least(10, greatest(0, p_raridade)) ^ 2 + least(10, greatest(0, p_raridade)) * 3)::integer;
$$;

/*
  Poder de ataque a partir do loadout equipado.

  Repare que esta função lê `item_jogador` filtrando por slot — e o slot `skin`
  jamais entra em nenhuma soma. É assim que "skin nunca tem stat" (critério 5 da
  spec de origem) vira propriedade estrutural em vez de promessa.
*/
create or replace function public.poder_de_ataque(p_player_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  c_sinergia   constant numeric := 0.20;
  c_conjunto_2 constant numeric := 0.10;
  c_conjunto_3 constant numeric := 0.35;

  v_attr        public.atributo_jogador%rowtype;
  v_arma        public.item_jogador%rowtype;
  v_tipo_dano   text;
  v_poder_arma  numeric := 0;
  v_poder_acc   numeric := 0;
  v_principal   integer;
  v_secundario  integer;
  v_pecas       integer;
  v_mult        numeric := 1;
  v_acessorio   public.item_jogador%rowtype;
begin
  select * into v_attr from public.atributo_jogador where player_id = p_player_id;

  select * into v_arma
    from public.item_jogador
   where player_id = p_player_id and slot = 'arma';

  v_tipo_dano := coalesce(v_arma.tipo_dano, 'fisico');

  if v_arma.id is not null then
    v_poder_arma := public.poder_do_item(v_arma.raridade);
  end if;

  for v_acessorio in
    select * from public.item_jogador
     where player_id = p_player_id and slot in ('acessorio1', 'acessorio2')
  loop
    if v_acessorio.afinidade is not null and v_acessorio.afinidade = v_tipo_dano then
      v_poder_acc := v_poder_acc + public.poder_do_item(v_acessorio.raridade) * (1 + c_sinergia);
    else
      v_poder_acc := v_poder_acc + public.poder_do_item(v_acessorio.raridade);
    end if;
  end loop;

  -- Atributo que casa com a arma conta inteiro; o outro, pela metade.
  if v_tipo_dano = 'fisico' then
    v_principal  := coalesce(v_attr.forca, 0);
    v_secundario := coalesce(v_attr.inteligencia, 0);
  else
    v_principal  := coalesce(v_attr.inteligencia, 0);
    v_secundario := coalesce(v_attr.forca, 0);
  end if;

  -- Só o conjunto mais representado conta: 2 de um e 1 de outro ativam apenas
  -- o bônus de 2 do primeiro (critério 16).
  select coalesce(max(quantidade), 0) into v_pecas
    from (
      select count(*) as quantidade
        from public.item_jogador
       where player_id = p_player_id
         and slot in ('arma', 'acessorio1', 'acessorio2')
         and conjunto_id is not null
       group by conjunto_id
    ) as agrupado;

  if v_pecas >= 3 then
    v_mult := 1 + c_conjunto_3;
  elsif v_pecas >= 2 then
    v_mult := 1 + c_conjunto_2;
  end if;

  return floor((v_poder_arma + v_poder_acc + v_principal + (v_secundario / 2)) * v_mult)::integer;
end;
$$;

revoke execute on function public.poder_de_ataque(uuid) from public, anon, authenticated;

-- ============================================================================
-- resolver_ciclos — passa a receber o poder pronto em vez dos atributos crus.
--
-- Consequência importante: a função que decide recompensa não sabe o que é
-- item, arma ou skin. Ela recebe um número.
-- ============================================================================
drop function if exists public.resolver_ciclos(bigint, integer, integer, integer,
                                               integer, integer, integer);

create or replace function public.resolver_ciclos(
  p_nivel               bigint,
  p_vitalidade_inicial  integer,
  p_ciclos              integer,
  p_multiplicador_xp    integer,
  p_poder_ataque        integer,
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
  c_abates_base      constant integer := 3;
  c_xp_base_abate    constant integer := 4;
  c_moeda_base_abate constant integer := 2;
  c_dano_base_ciclo  constant integer := 8;
  c_ataque_por_abate constant integer := 8;

  v_abates_por_ciclo integer;
  v_xp_por_abate     bigint;
  v_moeda_por_abate  bigint;
  v_dano_por_ciclo   integer;
  v_vitalidade_max   integer;
  v_i                integer;
begin
  o_xp := 0;
  o_moeda := 0;
  o_ciclos_perdidos := 0;
  o_vitalidade := p_vitalidade_inicial;

  v_vitalidade_max   := public.vitalidade_maxima(p_nivel, coalesce(p_vitalidade, 0));
  v_abates_por_ciclo := c_abates_base + (p_nivel / 10)::integer
                        + (coalesce(p_poder_ataque, 0) / c_ataque_por_abate);
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
  public.resolver_ciclos(bigint, integer, integer, integer, integer, integer) from public;

-- ============================================================================
-- Arma inicial — o personagem nunca fica sem nada equipado (critério 8)
-- ============================================================================
create or replace function public.garantir_arma_inicial(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.item_jogador
              where player_id = p_player_id and tipo = 'arma') then
    return;
  end if;

  insert into public.item_jogador (player_id, tipo, raridade, origem, tipo_dano, slot)
  values (p_player_id, 'arma', 1, 'mundo', 'fisico', 'arma')
  returning id into v_id;
end;
$$;

revoke execute on function public.garantir_arma_inicial(uuid) from public, anon, authenticated;

-- ============================================================================
-- conceder_item — agora sorteia tipo de dano, afinidade e conjunto
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
  v_contador  bigint;
  v_raridade  smallint;
  v_semente   text;
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

  if p_tipo = 'chave' then
    v_raridade := 1;
  else
    v_raridade := public.escalar_raridade(v_semente, p_piso, p_teto, p_sorte);
  end if;

  -- Conjunto só a partir de épico (critério 14). Sorteado antes do tipo de
  -- dano porque, quando existe, é ele que decide o tema (critério 17).
  if p_tipo in ('arma', 'acessorio') and v_raridade >= 4 then
    if public.sorteio01(v_semente || ':conj') < 0.5 then
      v_lista := public.conjuntos_disponiveis();
      v_conjunto := v_lista[1 + floor(public.sorteio01(v_semente || ':qual')
                                      * array_length(v_lista, 1))::integer];
    end if;
  end if;

  if p_tipo = 'arma' then
    v_tipo_dano := coalesce(
      public.tipo_dano_do_conjunto(v_conjunto),
      case when public.sorteio01(v_semente || ':dano') < 0.5 then 'fisico' else 'magico' end
    );
  elsif p_tipo = 'acessorio' then
    -- Nem todo acessório tem afinidade; sem ela, contribui o stat normal.
    if v_conjunto is not null then
      v_afinidade := public.tipo_dano_do_conjunto(v_conjunto);
    elsif public.sorteio01(v_semente || ':afin') < 0.6 then
      v_afinidade := case when public.sorteio01(v_semente || ':afin2') < 0.5
                          then 'fisico' else 'magico' end;
    end if;
  end if;

  insert into public.item_jogador (player_id, tipo, raridade, origem,
                                   tipo_dano, afinidade, conjunto_id)
  values (p_player_id, p_tipo, v_raridade, p_origem, v_tipo_dano, v_afinidade, v_conjunto)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.conceder_item(uuid, text, smallint, smallint, text, integer)
  from public, anon, authenticated;

-- ============================================================================
-- creditar_ciclos — passa o poder de ataque, e garante a arma inicial
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
begin
  -- Idempotente e barato: o personagem nunca fica sem arma, e isso é conferido
  -- aqui para não exigir reescrever `iniciar_sessao` mais uma vez.
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

  return jsonb_build_object(
    'xp', v_xp, 'moeda', v_moeda, 'ciclosPerdidos', v_perdidos,
    'poderDeAtaque', v_poder,
    'subiuDeNivel', v_jog.nivel > v_nivel_antes, 'drops', v_drops
  );
end;
$$;

revoke execute on function public.creditar_ciclos(uuid, integer, integer, boolean)
  from public, anon, authenticated;

-- ============================================================================
-- equipar_item — substitui equipar_skin, que só sabia lidar com um slot
-- ============================================================================
create or replace function public.equipar_item(p_item_id uuid, p_slot text)
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

  if p_slot not in ('arma', 'acessorio1', 'acessorio2', 'skin') then
    raise exception 'SLOT_INVALIDO';
  end if;

  -- Posse e tipo conferidos no servidor (critério 18): o client manda um id,
  -- não uma afirmação sobre o que ele é.
  select * into v_item
    from public.item_jogador
   where id = p_item_id and player_id = v_uid;

  if v_item.id is null then
    raise exception 'ITEM_INEXISTENTE';
  end if;

  if (p_slot = 'arma'  and v_item.tipo <> 'arma')
     or (p_slot = 'skin' and v_item.tipo <> 'skin')
     or (p_slot in ('acessorio1', 'acessorio2') and v_item.tipo <> 'acessorio') then
    raise exception 'TIPO_NAO_CABE_NO_SLOT';
  end if;

  -- Troca livre, sem cooldown e sem custo (critério 5 do spec de build).
  update public.item_jogador set slot = null
   where player_id = v_uid and slot = p_slot;

  update public.item_jogador set slot = p_slot where id = p_item_id;

  return public.montar_snapshot(v_uid);
end;
$$;

drop function if exists public.equipar_skin(uuid);

revoke execute on function public.equipar_item(uuid, text) from public;
grant execute on function public.equipar_item(uuid, text) to authenticated;

-- ============================================================================
-- Inventário — passa a expor o loadout e os itens equipáveis
-- ============================================================================
create or replace function public.montar_inventario(p_uid uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'chaves', (select count(*) from public.item_jogador
                where player_id = p_uid and tipo = 'chave'),
    'poderDeAtaque', public.poder_de_ataque(p_uid),
    'loadout', coalesce((
      select jsonb_object_agg(slot, jsonb_build_object(
               'id', id, 'tipo', tipo, 'raridade', raridade,
               'tipoDano', tipo_dano, 'afinidade', afinidade, 'conjuntoId', conjunto_id))
        from public.item_jogador
       where player_id = p_uid and slot is not null
    ), '{}'::jsonb),
    'equipaveis', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', id, 'tipo', tipo, 'raridade', raridade, 'slot', slot,
               'tipoDano', tipo_dano, 'afinidade', afinidade, 'conjuntoId', conjunto_id)
             order by raridade desc, obtido_em)
        from public.item_jogador
       where player_id = p_uid and tipo in ('arma', 'acessorio', 'skin')
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
-- Síntese — item equipado que é consumido precisa sair do slot sozinho
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

  -- `order by slot nulls first` gasta os guardados antes dos equipados; apagar
  -- a linha já tira o item do slot, então não sobra referência órfã.
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

  -- Se a arma equipada foi consumida, o personagem não pode ficar sem nada.
  perform public.garantir_arma_inicial(v_uid);

  insert into public.evento_jogo (player_id, tipo, dados)
  values (v_uid, 'item.sintetizado',
          jsonb_build_object('tipo', p_tipo, 'de', p_raridade, 'para', v_produz));

  return public.montar_snapshot(v_uid)
         || jsonb_build_object('sintese', jsonb_build_object(
              'consumidos', v_consumido, 'produziuRaridade', v_produz));
end;
$$;
