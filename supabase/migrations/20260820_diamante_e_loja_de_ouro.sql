-- ============================================================================
-- Autohunt Idle — diamante e loja de ouro.
--
-- Implementa os critérios 1 a 4 de `specs/mercado-diamante.md`
-- (ver `specs/build-fase-3f-diamante-loja-ouro.md`), e fecha o critério 2 de
-- `specs/fortificacao-de-item.md` — a loja de ouro que faltava.
--
-- O MERCADO P2P NÃO ESTÁ AQUI, e não é esquecimento: `memory/restrictions.md`
-- registra que chat e marketplace "entram no roadmap só com plano de segurança
-- específico escrito primeiro", e `docs/11_SEGURANCA/` ainda é o esqueleto da
-- fundação.
--
-- A REGRA QUE SUSTENTA TUDO ISSO (critério 3 da spec de origem, e restrição
-- CRÍTICA permanente): diamante nunca vira dinheiro de volta, por rota nenhuma.
-- É o que permite vendê-lo como moeda de jogo em vez de disparar a restrição de
-- transmissão de valor entre pessoas. Repare que o único lugar do schema inteiro
-- que DEBITA diamante é `comprar_ouro` — e ela entrega ouro, não dinheiro.
-- ============================================================================

alter table public.jogador
  add column if not exists diamante bigint not null default 0 check (diamante >= 0);

comment on column public.jogador.diamante is
  'Saldo de diamante. Ganho em dungeon e (quando houver gateway) comprado do operador. NUNCA convertido de volta em dinheiro.';

-- ---------------------------------------------------------------------------
-- Pacotes de ouro — dados em tabela, não número escondido em função.
--
-- Ser tabela é o que permite o client exibir o preço exato antes da compra
-- (restrição ética de transparência) e o que torna auditável que a quantidade
-- é FIXA: não há faixa, sorteio nem bônus aleatório em lugar nenhum.
-- ---------------------------------------------------------------------------
create table if not exists public.pacote_ouro (
  id         text primary key,
  diamantes  integer not null check (diamantes > 0),
  ouro       bigint  not null check (ouro > 0),
  ativo      boolean not null default true,
  ordem      integer not null default 0
);

insert into public.pacote_ouro (id, diamantes, ouro, ordem) values
  ('punhado',  10,   5000,   1),
  ('saco',     50,   30000,  2),
  ('bau',      200,  150000, 3)
on conflict (id) do nothing;

comment on table public.pacote_ouro is
  'Pacotes de ouro vendidos por diamante. Quantidade fixa e publicada — nunca faixa, nunca sorteio.';

alter table public.pacote_ouro enable row level security;

drop policy if exists pacote_leitura_publica on public.pacote_ouro;
-- O catálogo é público por natureza: o jogador precisa ver o preço antes de
-- decidir. Não há dado pessoal aqui.
create policy pacote_leitura_publica on public.pacote_ouro
  for select using (auth.uid() is not null);

revoke all on public.pacote_ouro from anon, authenticated;
grant select on public.pacote_ouro to authenticated;

-- ============================================================================
-- comprar_ouro — o ÚNICO débito de diamante do schema inteiro.
--
-- Recebe o id do pacote, que é uma escolha do jogador. Não recebe quantidade,
-- preço nem saldo: tudo isso está na tabela, do lado do servidor.
-- ============================================================================
create or replace function public.comprar_ouro(p_pacote text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_pacote public.pacote_ouro%rowtype;
  v_saldo  bigint;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select * into v_pacote from public.pacote_ouro where id = p_pacote and ativo;
  if v_pacote.id is null then
    raise exception 'PACOTE_INDISPONIVEL';
  end if;

  -- Trava a linha: duas compras simultâneas com saldo para só uma não passam
  -- as duas.
  select diamante into v_saldo from public.jogador where id = v_uid for update;

  if v_saldo < v_pacote.diamantes then
    raise exception 'DIAMANTE_INSUFICIENTE';
  end if;

  -- Débito e crédito na mesma instrução: ou os dois acontecem, ou nenhum.
  update public.jogador
     set diamante      = diamante - v_pacote.diamantes,
         moeda         = moeda + v_pacote.ouro,
         atualizado_em = now()
   where id = v_uid;

  insert into public.evento_jogo (player_id, tipo, dados)
  values (v_uid, 'ouro.comprado',
          jsonb_build_object('pacote', v_pacote.id, 'diamantes', v_pacote.diamantes,
                             'ouro', v_pacote.ouro));

  return public.montar_snapshot(v_uid) || jsonb_build_object(
    'compra', jsonb_build_object('pacote', v_pacote.id, 'ouroRecebido', v_pacote.ouro)
  );
end;
$$;

revoke execute on function public.comprar_ouro(text) from public;
grant execute on function public.comprar_ouro(text) to authenticated;

-- ============================================================================
-- creditar_diamante — CHAMÁVEL SÓ PELO SERVIDOR.
--
-- Mesmo padrão da assinatura: o crédito de diamante comprado com dinheiro real
-- entra por webhook assinado do gateway, nunca por rota que o jogador alcance.
-- Sem gateway contratado (P3 do backlog), nada chama esta função ainda.
-- ============================================================================
create or replace function public.creditar_diamante(
  p_player_id  uuid,
  p_quantidade integer,
  p_referencia text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_quantidade is null or p_quantidade <= 0 then
    return jsonb_build_object('creditado', false, 'motivo', 'QUANTIDADE_INVALIDA');
  end if;

  if not exists (select 1 from public.jogador where id = p_player_id) then
    return jsonb_build_object('creditado', false, 'motivo', 'JOGADOR_INEXISTENTE');
  end if;

  update public.jogador
     set diamante = diamante + p_quantidade, atualizado_em = now()
   where id = p_player_id;

  insert into public.evento_jogo (player_id, tipo, dados)
  values (p_player_id, 'diamante.creditado',
          jsonb_build_object('quantidade', p_quantidade, 'referencia', p_referencia));

  return jsonb_build_object('creditado', true, 'quantidade', p_quantidade);
end;
$$;

revoke execute on function public.creditar_diamante(uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.creditar_diamante(uuid, integer, text) to service_role;

-- ============================================================================
-- Dungeon vencida concede diamante — a fonte GRATUITA.
--
-- Não é detalhe de balanceamento: é o que faz o caminho sem pagar existir de
-- verdade, que por sua vez é a condição de compliance da fortificação
-- (`specs/fortificacao-de-item.md`, seção 2.1, condição 2).
-- ============================================================================
create or replace function public.resolver_uma_dungeon(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_diamante_por_vitoria constant integer := 2;

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

  v_poder := 10 + public.poder_de_ataque(p_player_id);
  v_poder_boss := 10 + v_jog.nivel * 1.2;
  v_venceu := v_poder >= v_poder_boss;

  if v_venceu then
    v_piso := 3;   -- raro garantido
    v_teto := 10;
    -- Perder já custa a chave; não custa mais nada (critério 5 da spec de
    -- dungeon). Por isso o diamante só entra na vitória.
    update public.jogador
       set diamante = diamante + c_diamante_por_vitoria, atualizado_em = now()
     where id = p_player_id;
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

  return jsonb_build_object(
    'resolvida', true,
    'venceu', v_venceu,
    'diamante', case when v_venceu then c_diamante_por_vitoria else 0 end
  );
end;
$$;

revoke execute on function public.resolver_uma_dungeon(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Snapshot — expõe saldo de diamante e o catálogo da loja
-- ---------------------------------------------------------------------------
create or replace function public.montar_loja_ouro()
returns jsonb
language sql
stable
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('id', id, 'diamantes', diamantes, 'ouro', ouro)
              order by ordem),
    '[]'::jsonb)
    from public.pacote_ouro
   where ativo;
$$;

revoke execute on function public.montar_loja_ouro() from public;

-- ---------------------------------------------------------------------------
-- montar_snapshot — ganha saldo de diamante e o catálogo da loja
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
