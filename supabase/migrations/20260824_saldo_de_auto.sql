-- ============================================================================
-- Autohunt Idle — o saldo do modo automático.
--
-- Implementa a decisão 3.3 de `specs/mundo-aberto-e-modo-manual.md`: **auto na
-- tela e farm offline são produtos separados**, cada um com seu saldo, seu teto
-- e seu anúncio.
--
-- O CONTEXTO, porque o schema sozinho não conta: até 2026-08-12 o jogo era
-- auto-play e o mundo era enfeite. A premissa inverteu — o jogo passou a ser
-- MANUAL, e o auto virou o que se vende. Quem quer largar o personagem jogando
-- e ir embora compra esse direito, com anúncio ou assinatura.
--
-- O QUE NÃO MUDA, e é o mais importante: **manual e auto creditam exatamente o
-- mesmo**. Nenhuma função aqui recebe modo, e `validar_lote` continua sem
-- parâmetro nenhum. O servidor não sabe — nem precisa saber — quem estava no
-- comando. É o que mantém as 13 ameaças que pendem de "o client nunca declara
-- ganho" fechadas, sem uma linha de anti-cheat.
-- ============================================================================

alter table public.farm_state
  add column if not exists minutos_auto_saldo integer not null default 0
    check (minutos_auto_saldo >= 0),
  add column if not exists minutos_auto_creditados integer not null default 0
    check (minutos_auto_creditados >= 0),
  add column if not exists janela_auto_iniciada_em timestamptz not null default now();

comment on column public.farm_state.minutos_auto_saldo is
  'Minutos de auto NA TELA. Produto distinto do farm offline — gastar um não consome o outro.';

-- O client passa a ler o saldo novo; `contador_sorteio` continua fora, porque
-- é metade da semente de todo sorteio (migration 20260823).
revoke select on public.farm_state from authenticated;
grant select (player_id, last_seen_at, minutos_acumulados, xp_pendente, moeda_pendente,
              minutos_anuncio_saldo, minutos_anuncio_creditados, janela_anuncio_iniciada_em,
              minutos_auto_saldo, minutos_auto_creditados, janela_auto_iniciada_em,
              ultimo_motivo)
  on public.farm_state to authenticated;

-- ---------------------------------------------------------------------------
-- O ticket ganha finalidade
--
-- Um anúncio assistido para destravar auto não pode virar minuto de farm
-- offline, e vice-versa: são dois produtos. A finalidade fica no TICKET, que é
-- emitido pelo servidor — não no pedido de crédito, que viria do client.
-- ---------------------------------------------------------------------------
alter table public.ticket_anuncio
  add column if not exists finalidade text not null default 'offline'
    check (finalidade in ('offline', 'auto'));

comment on column public.ticket_anuncio.finalidade is
  'Qual produto este anúncio destrava. Decidida na emissão, pelo servidor — o crédito só lê.';

-- ---------------------------------------------------------------------------
-- Reciclagem da janela de 24h do auto — espelha a do anúncio offline.
-- ---------------------------------------------------------------------------
create or replace function public.reciclar_janela_auto(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.farm_state
     set minutos_auto_creditados = 0,
         janela_auto_iniciada_em = now()
   where player_id = p_uid
     and now() - janela_auto_iniciada_em >= interval '24 hours';
end;
$$;

revoke execute on function public.reciclar_janela_auto(uuid) from public, anon, authenticated;

-- ============================================================================
-- emitir_ticket_auto — o irmão de `emitir_ticket_anuncio`, para o outro produto
--
-- É uma RPC SEPARADA, e não um parâmetro na existente, de propósito: as RPCs
-- que creditam valor são obrigadas a ter ZERO parâmetro (core, 3), e um campo
-- "finalidade" vindo do client abriria a porta que o contrato inteiro fecha.
-- Duas funções sem parâmetro custam mais linhas e não custam invariante.
-- ============================================================================
create or replace function public.emitir_ticket_auto()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_minutos_por_anuncio constant integer := 15;
  c_teto_diario         constant integer := 120;

  v_uid       uuid := auth.uid();
  v_fs        public.farm_state%rowtype;
  v_ass       public.assinatura%rowtype;
  v_assinante boolean;
  v_ticket    uuid;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select * into v_fs from public.farm_state where player_id = v_uid for update;
  if v_fs.player_id is null then
    raise exception 'SESSAO_NAO_INICIADA';
  end if;

  select * into v_ass from public.assinatura where player_id = v_uid;
  v_assinante := coalesce(v_ass.status in ('ativa', 'cancelada')
                          and v_ass.expira_em > now(), false);

  -- Assinante tem auto sem limite; oferecer anúncio a quem já pagou é cobrar
  -- duas vezes pela mesma coisa.
  if v_assinante then
    return jsonb_build_object('emitido', false, 'motivo', 'ASSINANTE_NAO_PRECISA');
  end if;

  perform public.reciclar_janela_auto(v_uid);
  select * into v_fs from public.farm_state where player_id = v_uid for update;

  if v_fs.minutos_auto_creditados >= c_teto_diario then
    return jsonb_build_object(
      'emitido', false,
      'motivo', 'TETO_DIARIO_ATINGIDO',
      'proximaJanelaEm', v_fs.janela_auto_iniciada_em + interval '24 hours'
    );
  end if;

  if v_fs.minutos_auto_saldo >= c_teto_diario then
    return jsonb_build_object('emitido', false, 'motivo', 'SALDO_JA_NO_TETO');
  end if;

  insert into public.ticket_anuncio (player_id, minutos, finalidade, expira_em)
  values (v_uid, c_minutos_por_anuncio, 'auto', now() + interval '10 minutes')
  returning id into v_ticket;

  return jsonb_build_object(
    'emitido', true, 'ticketId', v_ticket, 'minutos', c_minutos_por_anuncio
  );
end;
$$;

revoke execute on function public.emitir_ticket_auto() from public;
grant execute on function public.emitir_ticket_auto() to authenticated;

-- ============================================================================
-- creditar_anuncio — passa a creditar o BALDE CERTO
--
-- Lê a finalidade DO TICKET. O client nunca informa qual produto está
-- destravando: ele apenas apresenta o ticket que o servidor emitiu.
--
-- `aplicar_credito_anuncio` fica como está, de propósito: ela nasceu quando só
-- existia o produto offline e continua servindo a ele. Redefini-la aqui só
-- criaria uma segunda versão da mesma regra.
-- ============================================================================
create or replace function public.creditar_anuncio(p_ticket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_teto_diario constant integer := 120;
  v_ticket      public.ticket_anuncio%rowtype;
begin
  -- Trava o ticket: dois callbacks do mesmo anúncio não podem creditar duas
  -- vezes. `skip locked` faria o segundo passar direto — aqui ele espera e
  -- então encontra `resgatado_em` preenchido.
  select * into v_ticket
    from public.ticket_anuncio
   where id = p_ticket_id
     for update;

  if v_ticket.id is null then
    return jsonb_build_object('creditado', false, 'motivo', 'TICKET_INEXISTENTE');
  end if;
  if v_ticket.resgatado_em is not null then
    return jsonb_build_object('creditado', false, 'motivo', 'TICKET_JA_RESGATADO');
  end if;
  if v_ticket.expira_em < now() then
    return jsonb_build_object('creditado', false, 'motivo', 'TICKET_EXPIRADO');
  end if;

  update public.ticket_anuncio set resgatado_em = now() where id = p_ticket_id;

  -- A finalidade veio do ticket, ou seja, do servidor.
  if v_ticket.finalidade = 'auto' then
    perform public.reciclar_janela_auto(v_ticket.player_id);
    update public.farm_state
       set minutos_auto_saldo      = least(c_teto_diario, minutos_auto_saldo + v_ticket.minutos),
           minutos_auto_creditados = minutos_auto_creditados + v_ticket.minutos
     where player_id = v_ticket.player_id;
  else
    perform public.reciclar_janela_anuncio(v_ticket.player_id);
    update public.farm_state
       set minutos_anuncio_saldo      = least(c_teto_diario, minutos_anuncio_saldo + v_ticket.minutos),
           minutos_anuncio_creditados = minutos_anuncio_creditados + v_ticket.minutos
     where player_id = v_ticket.player_id;
  end if;

  insert into public.evento_jogo (player_id, tipo, dados)
  values (v_ticket.player_id, 'anuncio.creditado',
          jsonb_build_object('minutos', v_ticket.minutos, 'finalidade', v_ticket.finalidade));

  return jsonb_build_object(
    'creditado', true, 'minutos', v_ticket.minutos, 'finalidade', v_ticket.finalidade
  );
end;
$$;

revoke execute on function public.creditar_anuncio(uuid) from public, anon, authenticated;
grant execute on function public.creditar_anuncio(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- montar_snapshot — ganha os minutos de auto
--
-- Repetida por inteiro, como nas rodadas anteriores: o Postgres não estende
-- função, e um wrapper esconderia de quem lê onde o payload é montado.
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
      'minutosAutoSaldo',         v_fs.minutos_auto_saldo,
      'minutosAutoRestantes',     greatest(0, 120 - v_fs.minutos_auto_creditados),
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
