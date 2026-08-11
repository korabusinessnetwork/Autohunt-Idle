-- ============================================================================
-- Autohunt Idle — sessão passa a usar o caminho de crédito fatorado e a
-- resolver dungeons acumuladas na ausência.
--
-- `iniciar_sessao`, `validar_lote` e `coletar_farm_offline` ficam finas: toda a
-- regra de recompensa (ciclos + nível + atributos + loot) vive em
-- `creditar_ciclos`. É essa fatoração que evita reescrever estas três funções
-- inteiras a cada mecânica nova.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Snapshot — ganha o inventário
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

-- ---------------------------------------------------------------------------
-- iniciar_sessao
-- ---------------------------------------------------------------------------
create or replace function public.iniciar_sessao()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_limite_lote_segundos  constant integer := 120;
  c_ciclo_segundos        constant integer := 15;
  c_teto_assinante_min    constant integer := 1440;
  -- Ausência longa acumula muitas chaves; o teto por retorno é o edge case da
  -- spec de origem. As chaves que sobram continuam guardadas.
  c_teto_dungeons_retorno constant integer := 10;

  v_uid                uuid := auth.uid();
  v_fs                 public.farm_state%rowtype;
  v_ass                public.assinatura%rowtype;
  v_assinante          boolean;
  v_multiplicador      integer;
  v_segundos           numeric;
  v_minutos_decorridos integer;
  v_teto_minutos       integer;
  v_minutos_creditados integer;
  v_ciclos             integer;
  v_motivo             text;
  v_venceu             boolean := false;
  v_credito            jsonb;
  v_dungeons           jsonb := jsonb_build_object('resolvidas', 0, 'vitorias', 0);
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  insert into public.jogador (id)                 values (v_uid) on conflict (id) do nothing;
  insert into public.farm_state (player_id)       values (v_uid) on conflict (player_id) do nothing;
  insert into public.assinatura (player_id)       values (v_uid) on conflict (player_id) do nothing;
  insert into public.atributo_jogador (player_id) values (v_uid) on conflict (player_id) do nothing;

  select * into v_fs  from public.farm_state where player_id = v_uid for update;
  select * into v_ass from public.assinatura where player_id = v_uid for update;

  if v_ass.status in ('ativa', 'cancelada') and v_ass.expira_em <= now() then
    update public.assinatura set status = 'vencida', atualizada_em = now()
     where player_id = v_uid;

    update public.farm_state
       set minutos_acumulados = 0, xp_pendente = 0, moeda_pendente = 0
     where player_id = v_uid;

    v_fs.minutos_acumulados := 0;
    v_venceu := true;

    insert into public.evento_jogo (player_id, tipo, dados)
    values (v_uid, 'assinatura.vencida', jsonb_build_object('pendenteZerado', true));
  end if;

  v_assinante := (v_ass.status in ('ativa', 'cancelada') and v_ass.expira_em > now());
  v_multiplicador := case when v_assinante then 2 else 1 end;

  if now() - v_fs.janela_anuncio_iniciada_em >= interval '24 hours' then
    update public.farm_state
       set minutos_anuncio_creditados = 0, janela_anuncio_iniciada_em = now()
     where player_id = v_uid;
    v_fs.minutos_anuncio_saldo := v_fs.minutos_anuncio_saldo;
  end if;

  v_segundos := extract(epoch from (now() - v_fs.last_seen_at));

  if v_segundos <= c_limite_lote_segundos then
    -- Recarregar a página ou um blip de rede não é "ficar offline".
    v_ciclos := floor(v_segundos / c_ciclo_segundos)::integer;
    v_credito := public.creditar_ciclos(v_uid, v_ciclos, v_multiplicador, false);

    update public.farm_state
       set last_seen_at = last_seen_at + make_interval(secs => v_ciclos * c_ciclo_segundos),
           ultimo_motivo = case when v_venceu then 'assinatura_vencida' else ultimo_motivo end
     where player_id = v_uid;

    return public.montar_snapshot(v_uid) || jsonb_build_object(
      'retorno', jsonb_build_object(
        'houveAusencia', false, 'minutosDecorridos', 0, 'minutosCreditados', 0,
        'xpGanho', 0, 'moedaGanha', 0,
        'tetoMinutos', case when v_assinante then c_teto_assinante_min
                            else v_fs.minutos_anuncio_saldo end,
        'motivo', case when v_venceu then 'assinatura_vencida' else 'primeira_sessao' end
      )
    );
  end if;

  -- Ausência de verdade → farm offline.
  v_minutos_decorridos := floor(v_segundos / 60)::integer;
  v_teto_minutos := case when v_assinante then c_teto_assinante_min
                         else v_fs.minutos_anuncio_saldo end;
  v_minutos_creditados := least(v_minutos_decorridos, v_teto_minutos);
  v_ciclos := (v_minutos_creditados * 60 / c_ciclo_segundos)::integer;

  v_credito := public.creditar_ciclos(v_uid, v_ciclos, v_multiplicador, true);

  if v_venceu then
    v_motivo := 'assinatura_vencida';
  elsif v_minutos_creditados = 0 then
    v_motivo := 'sem_desbloqueio';
  elsif v_minutos_creditados < v_minutos_decorridos then
    v_motivo := case when v_assinante then 'teto_assinante' else 'teto_anuncio' end;
  else
    v_motivo := 'creditado';
  end if;

  update public.farm_state
     set last_seen_at          = now(),
         minutos_acumulados    = minutos_acumulados + v_minutos_creditados,
         minutos_anuncio_saldo = case when v_assinante then minutos_anuncio_saldo
                                      else minutos_anuncio_saldo - v_minutos_creditados end,
         ultimo_motivo         = v_motivo
   where player_id = v_uid;

  -- As dungeons acumuladas na ausência são resolvidas pelo SERVIDOR: o client
  -- nunca declara quantas chaves tinha nem qual foi o resultado (critério 10 da
  -- spec de origem).
  if v_ciclos > 0 then
    v_dungeons := public.resolver_dungeons(v_uid, c_teto_dungeons_retorno);
  end if;

  insert into public.evento_jogo (player_id, tipo, dados)
  values (v_uid, 'farm.calculado',
          jsonb_build_object('minutosDecorridos', v_minutos_decorridos,
                             'minutosCreditados', v_minutos_creditados,
                             'motivo', v_motivo, 'dungeons', v_dungeons));

  return public.montar_snapshot(v_uid) || jsonb_build_object(
    'retorno', jsonb_build_object(
      'houveAusencia',     true,
      'minutosDecorridos', v_minutos_decorridos,
      'minutosCreditados', v_minutos_creditados,
      'xpGanho',           (v_credito ->> 'xp')::bigint,
      'moedaGanha',        (v_credito ->> 'moeda')::bigint,
      'ciclosPerdidos',    (v_credito ->> 'ciclosPerdidos')::integer,
      'tetoMinutos',       v_teto_minutos,
      'motivo',            v_motivo,
      'drops',             v_credito -> 'drops',
      'dungeons',          v_dungeons
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- validar_lote
-- ---------------------------------------------------------------------------
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
  v_ass            public.assinatura%rowtype;
  v_assinante      boolean;
  v_segundos       numeric;
  v_segundos_uteis numeric;
  v_ciclos         integer;
  v_credito        jsonb;
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

  v_segundos := extract(epoch from (now() - v_fs.last_seen_at));
  -- Aba suspensa pelo navegador não é "ao vivo": o excedente é descartado.
  v_segundos_uteis := least(v_segundos, c_limite_lote_segundos);
  v_ciclos := floor(v_segundos_uteis / c_ciclo_segundos)::integer;

  if v_ciclos <= 0 then
    return public.montar_snapshot(v_uid) || jsonb_build_object(
      'lote', jsonb_build_object('ciclos', 0, 'xpGanho', 0, 'moedaGanha', 0)
    );
  end if;

  v_credito := public.creditar_ciclos(
    v_uid, v_ciclos, case when v_assinante then 2 else 1 end, false
  );

  update public.farm_state
     set last_seen_at = now()
                        - make_interval(secs => (v_segundos_uteis - v_ciclos * c_ciclo_segundos))
   where player_id = v_uid;

  return public.montar_snapshot(v_uid) || jsonb_build_object(
    'lote', jsonb_build_object(
      'ciclos',         v_ciclos,
      'ciclosPerdidos', (v_credito ->> 'ciclosPerdidos')::integer,
      'xpGanho',        (v_credito ->> 'xp')::bigint,
      'moedaGanha',     (v_credito ->> 'moeda')::bigint,
      'subiuDeNivel',   (v_credito ->> 'subiuDeNivel')::boolean,
      'drops',          v_credito -> 'drops'
    )
  );
end;
$$;
