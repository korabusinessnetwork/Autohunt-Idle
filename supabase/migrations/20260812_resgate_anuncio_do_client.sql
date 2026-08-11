-- ============================================================================
-- Autohunt Idle — resgate de anúncio atestado pelo client.
--
-- POR QUE ESTA MIGRATION EXISTE
--
-- O critério 7 de `specs/game-idle-farm-core.md` pede que a conclusão do
-- anúncio chegue por callback servidor-a-servidor do provedor. Os SDKs de
-- anúncio recompensado da Poki e da CrazyGames — os dois canais escolhidos —
-- são **client-side**: a conclusão volta como promise no navegador, e nenhum
-- dos dois oferece confirmação S2S. O critério, como escrito, é
-- inimplementável nesses canais.
--
-- O que dá para fazer, e é o que está aqui: manter TODA a autorização e TODOS
-- os tetos no servidor, deixando para o client apenas o atestado de que o
-- anúncio terminou. Concretamente, para creditar é preciso:
--   1. um ticket que o servidor emitiu (o client não inventa id válido);
--   2. que o ticket seja do jogador autenticado que está pedindo;
--   3. que ele nunca tenha sido resgatado e não tenha expirado;
--   4. que os tetos de 15 min/ticket, 2h/dia e saldo de 2h ainda comportem.
--
-- Exposição residual: um jogador que forje a conclusão do anúncio ganha, no
-- máximo, os mesmos 2h/dia que ganharia assistindo de verdade. Ver ADR-004 —
-- a decisão de aceitar esse limite é do dono, e está registrada como pendente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Núcleo do crédito, compartilhado pelos dois caminhos de resgate.
-- ---------------------------------------------------------------------------
create or replace function public.aplicar_credito_anuncio(
  p_player_id uuid,
  p_minutos   integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_teto_diario constant integer := 120;

  v_fs       public.farm_state%rowtype;
  v_creditar integer;
begin
  perform public.reciclar_janela_anuncio(p_player_id);

  select * into v_fs from public.farm_state where player_id = p_player_id for update;
  if v_fs.player_id is null then
    return jsonb_build_object('creditado', false, 'motivo', 'SESSAO_NAO_INICIADA');
  end if;

  -- Os tetos são reaplicados aqui, no servidor, toda vez — independentemente
  -- do que o client disse ter assistido.
  v_creditar := least(
    p_minutos,
    c_teto_diario - v_fs.minutos_anuncio_creditados,
    c_teto_diario - v_fs.minutos_anuncio_saldo
  );

  if v_creditar <= 0 then
    return jsonb_build_object('creditado', false, 'motivo', 'TETO_DIARIO_ATINGIDO');
  end if;

  update public.farm_state
     set minutos_anuncio_saldo      = minutos_anuncio_saldo + v_creditar,
         minutos_anuncio_creditados = minutos_anuncio_creditados + v_creditar
   where player_id = p_player_id;

  insert into public.evento_jogo (player_id, tipo, dados)
  values (p_player_id, 'anuncio.creditado', jsonb_build_object('minutos', v_creditar));

  return jsonb_build_object('creditado', true, 'minutos', v_creditar);
end;
$$;

revoke execute on function public.aplicar_credito_anuncio(uuid, integer)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Caminho 1 — callback servidor-a-servidor (provedor que suporte S2S).
-- Substitui a versão da migration anterior para reaproveitar o núcleo acima.
-- ---------------------------------------------------------------------------
create or replace function public.creditar_anuncio(p_ticket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_player  uuid;
  v_minutos integer;
begin
  update public.ticket_anuncio
     set resgatado_em = now()
   where id = p_ticket_id
     and resgatado_em is null
     and expira_em > now()
  returning player_id, minutos into v_player, v_minutos;

  if v_player is null then
    return jsonb_build_object('creditado', false, 'motivo', 'TICKET_INVALIDO_OU_JA_USADO');
  end if;

  return public.aplicar_credito_anuncio(v_player, v_minutos);
end;
$$;

-- ---------------------------------------------------------------------------
-- Caminho 2 — resgate atestado pelo client (Poki, CrazyGames).
--
-- A diferença para o caminho 1 é o `and player_id = p_player_id`: o resgate só
-- vale para o dono do ticket, e quem afirma quem é o jogador é o JWT conferido
-- na Edge Function, não o corpo da requisição.
-- ---------------------------------------------------------------------------
create or replace function public.resgatar_anuncio_do_jogador(
  p_ticket_id uuid,
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_minutos integer;
begin
  if p_player_id is null then
    return jsonb_build_object('creditado', false, 'motivo', 'NAO_AUTENTICADO');
  end if;

  -- Resgate atômico e com dono conferido: repetir a mesma chamada não acha
  -- linha, então replay não credita duas vezes.
  update public.ticket_anuncio
     set resgatado_em = now()
   where id = p_ticket_id
     and player_id = p_player_id
     and resgatado_em is null
     and expira_em > now()
  returning minutos into v_minutos;

  if v_minutos is null then
    return jsonb_build_object('creditado', false, 'motivo', 'TICKET_INVALIDO_OU_JA_USADO');
  end if;

  return public.aplicar_credito_anuncio(p_player_id, v_minutos);
end;
$$;

-- O jogador autenticado NÃO alcança esta função direto: ela é chamada pela
-- Edge Function `anuncio-resgate`, com a `service_role`, depois de conferir o
-- JWT. Assim o `player_id` nunca vem do corpo da requisição.
revoke execute on function public.resgatar_anuncio_do_jogador(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.resgatar_anuncio_do_jogador(uuid, uuid) to service_role;
