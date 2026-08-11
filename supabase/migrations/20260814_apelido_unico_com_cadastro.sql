-- ============================================================================
-- Autohunt Idle — apelido único, exigindo cadastro.
--
-- Reverte a decisão R2 registrada em `docs/09_BACKLOG/README.md` ("apelido
-- duplicado é permitido"), por decisão do dono.
--
-- POR QUE O CADASTRO ENTRA JUNTO
--
-- Só tornar o apelido único não bastaria: se uma conta anônima pudesse
-- reservar um nome, todo apelido bom acabaria preso a conta descartável que
-- ninguém consegue recuperar — `localStorage` limpo, janela anônima fechada, e
-- o nome fica ocupado para sempre por um jogador que não existe mais.
--
-- Isso não é regra nova: é exatamente o critério 18 do core aplicado a mais um
-- caso. Ele já diz que o cadastro é pedido "quando o jogador tenta fazer algo
-- que exige identidade permanente". Ocupar um nome único num placar público é
-- disso que se trata — junto com ativar o farm offline, que já era gate.
--
-- Quem joga só como convidado continua jogando igual: farma, sobe de nível,
-- distribui atributo. Só não entra no placar.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Unicidade — sem diferenciar maiúscula de minúscula.
--
-- "Duda" e "duda" seriam o mesmo nome aos olhos de qualquer jogador, então
-- deixar os dois coexistirem devolveria a personificação pela porta dos fundos.
-- ---------------------------------------------------------------------------
create unique index if not exists jogador_apelido_unico
  on public.jogador (lower(apelido))
  where apelido is not null;

-- ---------------------------------------------------------------------------
-- Identidade permanente — uma definição só, usada em todo lugar.
--
-- `email` só é preenchido depois da confirmação por link; enquanto ela está
-- pendente, o endereço fica em `email_change`. Os dois casos contam como
-- "criou credenciais".
-- ---------------------------------------------------------------------------
create or replace function public.identidade_verificada(p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_nascimento  date;
  v_credenciais boolean;
begin
  select data_nascimento into v_nascimento from public.jogador where id = p_uid;

  select (coalesce(email, '') <> '' or coalesce(email_change, '') <> '')
    into v_credenciais
    from auth.users
   where id = p_uid;

  return v_nascimento is not null and coalesce(v_credenciais, false);
end;
$$;

revoke execute on function public.identidade_verificada(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- definir_apelido — agora exige cadastro e recusa nome já usado
-- ---------------------------------------------------------------------------
create or replace function public.definir_apelido(p_apelido text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_limpo   text;
  v_posicao integer;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  -- Gate de identidade permanente (core, critério 18). Conta anônima joga
  -- normalmente; ela só não ocupa um nome no placar público.
  if not public.identidade_verificada(v_uid) then
    raise exception 'CADASTRO_NECESSARIO';
  end if;

  v_limpo := btrim(coalesce(p_apelido, ''));

  if char_length(v_limpo) < 3 or char_length(v_limpo) > 20 then
    raise exception 'APELIDO_TAMANHO_INVALIDO';
  end if;

  if v_limpo ~ '[[:cntrl:]]' then
    raise exception 'APELIDO_CARACTERE_INVALIDO';
  end if;

  begin
    update public.jogador set apelido = v_limpo, atualizado_em = now() where id = v_uid;
  exception
    -- O índice único é quem decide, não uma consulta prévia: entre "verificar
    -- se está livre" e "gravar" cabe outro jogador gravando o mesmo nome.
    when unique_violation then
      raise exception 'APELIDO_EM_USO';
  end;

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

revoke execute on function public.definir_apelido(text) from public;
grant execute on function public.definir_apelido(text) to authenticated;

-- ---------------------------------------------------------------------------
-- montar_snapshot — passa a usar a definição única de identidade permanente
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

  select (email is not null and email <> '')
    into v_tem_email
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
