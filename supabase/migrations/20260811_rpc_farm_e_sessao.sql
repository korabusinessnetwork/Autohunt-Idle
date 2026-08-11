-- ============================================================================
-- Autohunt Idle — RPCs de sessão, farm offline, anúncio e assinatura.
--
-- REGRA INEGOCIÁVEL (CLAUDE.md, ADR-001, memory/restrictions.md):
--   nenhuma função abaixo aceita timestamp, duração, XP, moeda ou abate vindo
--   do client. Repare que nenhuma assinatura de função exposta ao jogador tem
--   parâmetro nenhum — o servidor deriva tudo de `now()` e do estado gravado.
--   As duas únicas funções com parâmetro (`creditar_anuncio` e
--   `aplicar_evento_assinatura`) têm EXECUTE revogado de anon/authenticated:
--   só a `service_role` das Edge Functions alcança.
--
-- A simulação é determinística e sem aleatoriedade — de propósito. O mesmo
-- intervalo sempre rende o mesmo resultado, o que torna o cálculo auditável e
-- o espelho em TypeScript (`src/game/regrasFarm.ts`) verificável por teste.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Curva de XP — cresce quadraticamente e não tem teto (core, 12).
-- XP total exigido para alcançar o nível n: 50 * (n-1) * n
-- ---------------------------------------------------------------------------
create or replace function public.xp_acumulado_para_nivel(p_nivel bigint)
returns numeric
language sql
immutable
as $$
  select 50::numeric * (p_nivel - 1) * p_nivel;
$$;

create or replace function public.nivel_por_xp(p_xp bigint)
returns bigint
language plpgsql
immutable
as $$
declare
  v_nivel bigint;
begin
  if p_xp is null or p_xp <= 0 then
    return 1;
  end if;

  -- Inverso fechado da curva; o sqrt em ponto flutuante pode errar por 1 nas
  -- bordas, então os dois laços abaixo corrigem com aritmética exata.
  v_nivel := floor((1 + sqrt(1 + (4::numeric * p_xp) / 50)) / 2);
  if v_nivel < 1 then
    v_nivel := 1;
  end if;

  while public.xp_acumulado_para_nivel(v_nivel + 1) <= p_xp loop
    v_nivel := v_nivel + 1;
  end loop;

  while v_nivel > 1 and public.xp_acumulado_para_nivel(v_nivel) > p_xp loop
    v_nivel := v_nivel - 1;
  end loop;

  return v_nivel;
end;
$$;

comment on function public.nivel_por_xp(bigint) is
  'Nível a partir do XP total. Sem teto — o retorno é bigint e não existe constante de nível máximo.';

-- ---------------------------------------------------------------------------
-- Vitalidade máxima do nível. Escala com o nível para a frequência de
-- "derrota" não piorar conforme o jogador cresce.
-- ---------------------------------------------------------------------------
create or replace function public.vitalidade_maxima(p_nivel bigint)
returns integer
language sql
immutable
as $$
  select (100 + p_nivel * 10)::integer;
$$;

-- ---------------------------------------------------------------------------
-- resolver_ciclos — o motor único de recompensa.
--
-- Usado tanto pelo lote da sessão ao vivo quanto pelo farm offline: é a mesma
-- matemática nos dois casos, então não existe caminho "ao vivo" mais generoso
-- que o servidor não saiba auditar.
--
-- Um ciclo perdido (Vitalidade zerada) custa APENAS o rendimento daquele ciclo
-- (core, 16). Nada já creditado é retirado, e o personagem volta a farmar no
-- ciclo seguinte — sem cooldown, sem tela de morte.
-- ---------------------------------------------------------------------------
create or replace function public.resolver_ciclos(
  p_nivel               bigint,
  p_vitalidade_inicial  integer,
  p_ciclos              integer,
  p_multiplicador_xp    integer,
  out o_xp              bigint,
  out o_moeda           bigint,
  out o_vitalidade      integer,
  out o_ciclos_perdidos integer
)
language plpgsql
immutable
as $$
declare
  -- Constantes de balanceamento. Espelhadas em src/game/regrasFarm.ts —
  -- mudar aqui exige mudar lá (e o teste de paridade acusa se esquecer).
  c_abates_base        constant integer := 3;
  c_xp_base_abate      constant integer := 4;
  c_moeda_base_abate   constant integer := 2;
  c_dano_base_ciclo    constant integer := 8;

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

  v_vitalidade_max   := public.vitalidade_maxima(p_nivel);
  v_abates_por_ciclo := c_abates_base + (p_nivel / 10)::integer;
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
  public.resolver_ciclos(bigint, integer, integer, integer) from public;

-- ---------------------------------------------------------------------------
-- Snapshot do jogador — payload único que a UI consome.
--
-- Todos os números da tela de retorno saem daqui prontos: o client nunca
-- deriva rendimento nem duração do relógio local (core, edge case do relógio).
-- ---------------------------------------------------------------------------
create or replace function public.montar_snapshot(p_uid uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_jog          public.jogador%rowtype;
  v_fs           public.farm_state%rowtype;
  v_ass          public.assinatura%rowtype;
  v_assinante    boolean;
  v_tem_email    boolean;
  v_credenciais  boolean;
  v_xp_base      numeric;
  v_xp_proximo   numeric;
begin
  select * into v_jog from public.jogador    where id = p_uid;
  select * into v_fs  from public.farm_state where player_id = p_uid;
  select * into v_ass from public.assinatura where player_id = p_uid;

  if v_jog.id is null then
    return jsonb_build_object('existe', false);
  end if;

  v_assinante := coalesce(v_ass.status in ('ativa', 'cancelada')
                          and v_ass.expira_em > now(), false);

  -- `email` só é preenchido quando a confirmação por link acontece; enquanto
  -- ela está pendente, o endereço fica em `email_change`. Para saber se o
  -- jogador já criou credenciais, os dois casos contam.
  select (email is not null and email <> ''),
         (coalesce(email, '') <> '' or coalesce(email_change, '') <> '')
    into v_tem_email, v_credenciais
    from auth.users
   where id = p_uid;

  v_xp_base    := public.xp_acumulado_para_nivel(v_jog.nivel);
  v_xp_proximo := public.xp_acumulado_para_nivel(v_jog.nivel + 1);

  return jsonb_build_object(
    'existe', true,
    'jogador', jsonb_build_object(
      'nivel',              v_jog.nivel,
      'xpTotal',            v_jog.xp_total,
      'xpNoNivel',          (v_jog.xp_total - v_xp_base)::bigint,
      'xpParaProximoNivel', (v_xp_proximo - v_xp_base)::bigint,
      'moeda',              v_jog.moeda,
      'vitalidadeAtual',    v_jog.vitalidade_atual,
      'vitalidadeMaxima',   public.vitalidade_maxima(v_jog.nivel),
      'idioma',             v_jog.idioma,
      'temCadastro',        coalesce(v_tem_email, false),
      -- Cadastro concluído = passou pelo gate de idade E criou credenciais.
      -- Separada de `temCadastro` de propósito: com a confirmação de e-mail
      -- ligada, `auth.users.email` só é preenchido depois do clique no link, e
      -- gatear só por ele faria o modal reaparecer para quem já cadastrou.
      -- Exigir as duas metades evita o inverso — passar no gate de idade e
      -- ficar liberado mesmo se a criação de credenciais tiver falhado.
      'identidadeVerificada', (v_jog.data_nascimento is not null
                               and coalesce(v_credenciais, false))
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

-- ---------------------------------------------------------------------------
-- Reset da janela de 24h do anúncio (core, 8). Decidido pelo servidor.
-- ---------------------------------------------------------------------------
create or replace function public.reciclar_janela_anuncio(p_uid uuid)
returns void
language sql
as $$
  update public.farm_state
     set minutos_anuncio_creditados = 0,
         janela_anuncio_iniciada_em = now()
   where player_id = p_uid
     and now() - janela_anuncio_iniciada_em >= interval '24 hours';
$$;

revoke execute on function public.reciclar_janela_anuncio(uuid) from public;

-- ============================================================================
-- iniciar_sessao — ponto de entrada de todo reconnect.
--
-- Sem parâmetros, de propósito: não há por onde o client injetar tempo.
-- Faz, em uma transação e com a linha travada:
--   1. garante que jogador/farm_state/assinatura existem (conta anônima)
--   2. aplica o vencimento de assinatura, zerando o pendente (core, 9)
--   3. recicla a janela de anúncio se passaram 24h (core, 8)
--   4. resolve o intervalo desde `last_seen_at`:
--        · curto (<= 120s) → era a mesma sessão ao vivo, credita direto
--        · longo           → ausência de verdade, vira farm offline pendente
--   5. avança `last_seen_at` na mesma instrução que credita (sem crédito duplo)
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

  -- (1) Conta anônima já vale como conta de verdade: as linhas nascem aqui,
  -- no primeiro segundo de jogo, e nunca existe progresso fora delas (core, 17).
  insert into public.jogador (id)          values (v_uid) on conflict (id) do nothing;
  insert into public.farm_state (player_id) values (v_uid) on conflict (player_id) do nothing;
  insert into public.assinatura (player_id) values (v_uid) on conflict (player_id) do nothing;

  -- Trava a linha: duas abas ou duas reconexões simultâneas serializam aqui, e
  -- a segunda enxerga o `last_seen_at` já avançado — logo, não credita de novo.
  select * into v_fs  from public.farm_state where player_id = v_uid for update;
  select * into v_jog from public.jogador    where id = v_uid        for update;
  select * into v_ass from public.assinatura where player_id = v_uid for update;

  -- (2) Vencimento de fato ≠ clique de cancelar: 'cancelada' segue valendo até
  -- o fim do período pago. Só ao passar de `expira_em` o pendente é zerado.
  if v_ass.status in ('ativa', 'cancelada') and v_ass.expira_em <= now() then
    update public.assinatura
       set status = 'vencida', atualizada_em = now()
     where player_id = v_uid;

    v_fs.minutos_acumulados := 0;
    v_fs.xp_pendente        := 0;
    v_fs.moeda_pendente     := 0;
    v_venceu := true;

    insert into public.evento_jogo (player_id, tipo, dados)
    values (v_uid, 'assinatura.vencida',
            jsonb_build_object('pendenteZerado', true));
  end if;

  v_assinante := (v_ass.status in ('ativa', 'cancelada') and v_ass.expira_em > now());
  v_multiplicador := case when v_assinante then 2 else 1 end;

  -- (3) Janela de 24h do anúncio.
  if now() - v_fs.janela_anuncio_iniciada_em >= interval '24 hours' then
    v_fs.minutos_anuncio_creditados := 0;
    v_fs.janela_anuncio_iniciada_em := now();
  end if;

  v_segundos := extract(epoch from (now() - v_fs.last_seen_at));

  if v_segundos <= c_limite_lote_segundos then
    -- (4a) Recarregar a página ou um blip de rede não é "ficar offline".
    -- Credita como sessão ao vivo, direto no total, sem tela de retorno.
    v_ciclos := floor(v_segundos / c_ciclo_segundos)::integer;

    select o_xp, o_moeda, o_vitalidade, o_ciclos_perdidos
      into v_xp, v_moeda, v_vitalidade, v_perdidos
      from public.resolver_ciclos(v_jog.nivel, v_jog.vitalidade_atual,
                                  v_ciclos, v_multiplicador);

    update public.jogador
       set xp_total         = xp_total + v_xp,
           moeda            = moeda + v_moeda,
           nivel            = public.nivel_por_xp(xp_total + v_xp),
           vitalidade_atual = v_vitalidade,
           atualizado_em    = now()
     where id = v_uid;

    -- Guarda o resto sub-ciclo em vez de descartá-lo.
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

  -- (4b) Ausência de verdade → farm offline.
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
    from public.resolver_ciclos(v_jog.nivel, v_jog.vitalidade_atual,
                                v_ciclos, v_multiplicador);

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

  -- Instrução única: credita o pendente, consome o saldo de anúncio e avança
  -- `last_seen_at`. Não existe janela entre "creditou" e "avançou".
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

comment on function public.iniciar_sessao() is
  'Reconnect do jogador. Sem parâmetros por design: o client não tem por onde declarar tempo nem recompensa.';

-- ============================================================================
-- validar_lote — validação da sessão ao vivo (core, 15).
--
-- O client simula o combate localmente só para a sensação visual. Quem credita
-- é aqui, a cada ~15s, e o payload da chamada é vazio: o servidor não recebe
-- (nem poderia usar) abates, XP ou moeda declarados pelo client.
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

  v_uid           uuid := auth.uid();
  v_fs            public.farm_state%rowtype;
  v_jog           public.jogador%rowtype;
  v_ass           public.assinatura%rowtype;
  v_assinante     boolean;
  v_multiplicador integer;
  v_segundos      numeric;
  v_segundos_uteis numeric;
  v_ciclos        integer;
  v_xp            bigint;
  v_moeda         bigint;
  v_vitalidade    integer;
  v_perdidos      integer;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select * into v_fs from public.farm_state where player_id = v_uid for update;
  if v_fs.player_id is null then
    raise exception 'SESSAO_NAO_INICIADA';
  end if;

  select * into v_jog from public.jogador    where id = v_uid;
  select * into v_ass from public.assinatura where player_id = v_uid;

  v_assinante := coalesce(v_ass.status in ('ativa', 'cancelada')
                          and v_ass.expira_em > now(), false);
  v_multiplicador := case when v_assinante then 2 else 1 end;

  v_segundos := extract(epoch from (now() - v_fs.last_seen_at));

  -- Aba suspensa pelo navegador não é "ao vivo": o excedente além do limite é
  -- descartado, nunca convertido em farm offline por uma via lateral.
  v_segundos_uteis := least(v_segundos, c_limite_lote_segundos);
  v_ciclos := floor(v_segundos_uteis / c_ciclo_segundos)::integer;

  if v_ciclos <= 0 then
    return public.montar_snapshot(v_uid) || jsonb_build_object(
      'lote', jsonb_build_object('ciclos', 0, 'xpGanho', 0, 'moedaGanha', 0)
    );
  end if;

  select o_xp, o_moeda, o_vitalidade, o_ciclos_perdidos
    into v_xp, v_moeda, v_vitalidade, v_perdidos
    from public.resolver_ciclos(v_jog.nivel, v_jog.vitalidade_atual,
                                v_ciclos, v_multiplicador);

  update public.jogador
     set xp_total         = xp_total + v_xp,
         moeda            = moeda + v_moeda,
         nivel            = public.nivel_por_xp(xp_total + v_xp),
         vitalidade_atual = v_vitalidade,
         atualizado_em    = now()
   where id = v_uid;

  -- Preserva o resto sub-ciclo e descarta o que passou do limite.
  update public.farm_state
     set last_seen_at = now()
                        - make_interval(secs => (v_segundos_uteis - v_ciclos * c_ciclo_segundos))
   where player_id = v_uid;

  return public.montar_snapshot(v_uid) || jsonb_build_object(
    'lote', jsonb_build_object(
      'ciclos',         v_ciclos,
      'ciclosPerdidos', v_perdidos,
      'xpGanho',        v_xp,
      'moedaGanha',     v_moeda
    )
  );
end;
$$;

-- Encerrar a sessão é só creditar o último lote. Não existe flag de "sessão
-- aberta" para dessincronizar: `last_seen_at` parar de avançar já É o fim da
-- sessão, então matar o navegador dá o mesmo resultado que fechar a aba.
create or replace function public.encerrar_sessao()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.validar_lote();
$$;

-- ============================================================================
-- coletar_farm_offline — move o pendente para o total.
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

    insert into public.evento_jogo (player_id, tipo, dados)
    values (v_uid, 'farm.coletado',
            jsonb_build_object('xp', v_xp, 'moeda', v_moeda));
  end if;

  return public.montar_snapshot(v_uid) || jsonb_build_object(
    'coleta', jsonb_build_object('xpColetado', v_xp, 'moedaColetada', v_moeda)
  );
end;
$$;

-- ============================================================================
-- emitir_ticket_anuncio — o client pede permissão ANTES de assistir.
--
-- É o que impede o jogador de gastar 30s num anúncio que não renderia nada
-- (edge case do core): quando não dá pra creditar, a resposta diz o motivo e a
-- UI nem oferece o anúncio.
-- ============================================================================
create or replace function public.emitir_ticket_anuncio()
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

  -- Anúncio recompensado é exclusivo de quem não assina (core, 6).
  if v_assinante then
    return jsonb_build_object('emitido', false, 'motivo', 'ASSINANTE_NAO_PRECISA');
  end if;

  perform public.reciclar_janela_anuncio(v_uid);
  select * into v_fs from public.farm_state where player_id = v_uid for update;

  if v_fs.minutos_anuncio_creditados >= c_teto_diario then
    return jsonb_build_object(
      'emitido', false,
      'motivo', 'TETO_DIARIO_ATINGIDO',
      'proximaJanelaEm', v_fs.janela_anuncio_iniciada_em + interval '24 hours'
    );
  end if;

  if v_fs.minutos_anuncio_saldo >= c_teto_diario then
    return jsonb_build_object('emitido', false, 'motivo', 'SALDO_JA_NO_TETO');
  end if;

  insert into public.ticket_anuncio (player_id, minutos)
  values (v_uid, c_minutos_por_anuncio)
  returning id into v_ticket;

  return jsonb_build_object(
    'emitido', true,
    'ticketId', v_ticket,
    'minutos', c_minutos_por_anuncio
  );
end;
$$;

-- ============================================================================
-- creditar_anuncio — CHAMÁVEL SÓ PELO SERVIDOR.
--
-- O EXECUTE é revogado de anon/authenticated logo abaixo: um jogador com token
-- válido que tente chamar esta função direto recebe permission denied. O único
-- caminho de crédito é a Edge Function `anuncio-callback`, que só aceita
-- requisição com assinatura HMAC válida do provedor (core, 7).
-- ============================================================================
create or replace function public.creditar_anuncio(p_ticket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_teto_diario constant integer := 120;

  v_player   uuid;
  v_minutos  integer;
  v_fs       public.farm_state%rowtype;
  v_creditar integer;
begin
  -- Resgate atômico: a cláusula `resgatado_em is null` faz o replay do mesmo
  -- callback não encontrar linha, então não credita de novo.
  update public.ticket_anuncio
     set resgatado_em = now()
   where id = p_ticket_id
     and resgatado_em is null
     and expira_em > now()
  returning player_id, minutos into v_player, v_minutos;

  if v_player is null then
    return jsonb_build_object('creditado', false, 'motivo', 'TICKET_INVALIDO_OU_JA_USADO');
  end if;

  perform public.reciclar_janela_anuncio(v_player);

  select * into v_fs from public.farm_state where player_id = v_player for update;

  v_creditar := least(
    v_minutos,
    c_teto_diario - v_fs.minutos_anuncio_creditados,
    c_teto_diario - v_fs.minutos_anuncio_saldo
  );

  if v_creditar <= 0 then
    return jsonb_build_object('creditado', false, 'motivo', 'TETO_DIARIO_ATINGIDO');
  end if;

  update public.farm_state
     set minutos_anuncio_saldo      = minutos_anuncio_saldo + v_creditar,
         minutos_anuncio_creditados = minutos_anuncio_creditados + v_creditar
   where player_id = v_player;

  insert into public.evento_jogo (player_id, tipo, dados)
  values (v_player, 'anuncio.creditado',
          jsonb_build_object('minutos', v_creditar, 'ticketId', p_ticket_id));

  return jsonb_build_object('creditado', true, 'minutos', v_creditar);
end;
$$;

-- ============================================================================
-- aplicar_evento_assinatura — CHAMÁVEL SÓ PELO SERVIDOR (webhook do gateway).
-- ============================================================================
create or replace function public.aplicar_evento_assinatura(
  p_player_id  uuid,
  p_status     text,
  p_expira_em  timestamptz,
  p_provedor   text,
  p_referencia text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('ativa', 'cancelada', 'vencida') then
    return jsonb_build_object('aplicado', false, 'motivo', 'STATUS_INVALIDO');
  end if;

  if not exists (select 1 from public.jogador where id = p_player_id) then
    return jsonb_build_object('aplicado', false, 'motivo', 'JOGADOR_INEXISTENTE');
  end if;

  insert into public.assinatura (player_id, status, expira_em, provedor,
                                 referencia_externa, atualizada_em)
  values (p_player_id, p_status, p_expira_em, p_provedor, p_referencia, now())
  on conflict (player_id) do update
    set status             = excluded.status,
        expira_em          = excluded.expira_em,
        provedor           = excluded.provedor,
        referencia_externa = excluded.referencia_externa,
        atualizada_em      = now();

  -- Vencimento de fato zera o que estava acumulado e não coletado (core, 9).
  -- Cancelamento NÃO faz isso: o período pago continua valendo até `expira_em`.
  if p_status = 'vencida' then
    update public.farm_state
       set minutos_acumulados = 0,
           xp_pendente        = 0,
           moeda_pendente     = 0,
           ultimo_motivo      = 'assinatura_vencida'
     where player_id = p_player_id;
  end if;

  insert into public.evento_jogo (player_id, tipo, dados)
  values (p_player_id, 'assinatura.' ||
          case p_status when 'ativa' then 'ativada'
                        when 'cancelada' then 'cancelada'
                        else 'vencida' end,
          jsonb_build_object('expiraEm', p_expira_em, 'provedor', p_provedor));

  return jsonb_build_object('aplicado', true);
end;
$$;

-- ============================================================================
-- Leitura simples do estado (usada em refresh de UI).
-- ============================================================================
create or replace function public.estado_jogador()
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
  return public.montar_snapshot(v_uid);
end;
$$;

-- ============================================================================
-- Permissões — o que o jogador alcança e o que é exclusivo do servidor.
-- ============================================================================
revoke execute on function public.iniciar_sessao()        from public;
revoke execute on function public.validar_lote()          from public;
revoke execute on function public.encerrar_sessao()       from public;
revoke execute on function public.coletar_farm_offline()  from public;
revoke execute on function public.emitir_ticket_anuncio() from public;
revoke execute on function public.estado_jogador()        from public;

grant execute on function public.iniciar_sessao()        to authenticated;
grant execute on function public.validar_lote()          to authenticated;
grant execute on function public.encerrar_sessao()       to authenticated;
grant execute on function public.coletar_farm_offline()  to authenticated;
grant execute on function public.emitir_ticket_anuncio() to authenticated;
grant execute on function public.estado_jogador()        to authenticated;

-- Exclusivas do servidor: nem `anon` nem `authenticated` chegam nelas.
revoke execute on function public.creditar_anuncio(uuid) from public, anon, authenticated;
revoke execute on function public.aplicar_evento_assinatura(uuid, text, timestamptz, text, text)
  from public, anon, authenticated;
grant execute on function public.creditar_anuncio(uuid) to service_role;
grant execute on function public.aplicar_evento_assinatura(uuid, text, timestamptz, text, text)
  to service_role;
