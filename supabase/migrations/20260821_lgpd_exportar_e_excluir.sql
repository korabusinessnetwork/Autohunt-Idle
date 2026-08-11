-- ============================================================================
-- Autohunt Idle — LGPD: exportar e excluir os próprios dados.
--
-- Ver `specs/build-fase-3g-plano-de-seguranca.md`, critérios 5 a 8, e o
-- desenho em `docs/11_SEGURANCA/dados-pessoais-lgpd.md`.
--
-- POR QUE ISTO EXISTE: `docs/11_SEGURANCA/README.md` diz, desde a fundação,
-- que o direito de exportar e excluir "não é feature depois". O rascunho de
-- termos promete os dois ao usuário. Até esta migration, não havia uma linha
-- de código — a promessa existia só em prosa.
--
-- A FORMA DAS DUAS FUNÇÕES É A GARANTIA: nenhuma delas aceita `player_id`.
-- Operam exclusivamente sobre `auth.uid()`, então não existe assinatura de
-- função capaz de exportar ou apagar a conta de outra pessoa. Não é uma
-- checagem que alguém pode esquecer de fazer — é a ausência do parâmetro.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Correção de um GRANT largo demais
--
-- `CLAUDE.md`: "Nunca `select *` em tabelas sensíveis — sempre campos
-- explícitos". `assinatura` é a tabela que a regra nomeia, e estava concedida
-- inteira, incluindo `referencia_externa` — o identificador do jogador dentro
-- do gateway de pagamento.
--
-- O client nunca leu essas colunas: ele recebe o estado da assinatura pronto,
-- por `montar_snapshot`. O grant largo não servia a ninguém e ampliava a
-- superfície de graça.
--
-- A migration da fundação já foi corrigida para nascer com a lista de colunas.
-- Este bloco existe para o banco que já aplicou a versão antiga convergir —
-- num banco novo ele é redundante, e redundante aqui é de graça.
-- ---------------------------------------------------------------------------
revoke select on public.assinatura from authenticated;
grant select (player_id, status, expira_em, atualizada_em)
  on public.assinatura to authenticated;

comment on column public.assinatura.referencia_externa is
  'Identificador do jogador no gateway. NUNCA concedido ao client — só service_role alcança.';

-- ============================================================================
-- exportar_meus_dados — LGPD, direito de acesso e portabilidade
--
-- Devolve num JSON só tudo que o jogo guarda sobre quem chamou. Exportar é
-- leitura pura: não coleta farm pendente, não credita nada, não muda estado.
-- ============================================================================
create or replace function public.exportar_meus_dados()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select jsonb_build_object(
    'geradoEm', now(),
    'conta', jsonb_build_object(
      -- O e-mail vem de `auth.users` porque é lá que ele mora. Conta anônima
      -- não tem — e o JSON diz `null`, em vez de falhar (edge case da spec).
      'email',           (select email from auth.users where id = v_uid),
      'dataNascimento',  j.data_nascimento,
      'criadaEm',        j.criado_em,
      'idioma',          j.idioma
    ),
    'progresso', jsonb_build_object(
      'nivel',            j.nivel,
      'xpTotal',          j.xp_total,
      'moeda',            j.moeda,
      'diamante',         j.diamante,
      'vitalidadeAtual',  j.vitalidade_atual,
      'apelido',          j.apelido
    ),
    'atributos', (
      select jsonb_build_object('forca', a.forca, 'inteligencia', a.inteligencia,
                                'vitalidade', a.vitalidade, 'sorte', a.sorte,
                                'autoAlocar', a.auto_alocar)
        from public.atributo_jogador a where a.player_id = v_uid
    ),
    'farm', (
      select jsonb_build_object('minutosAcumulados', f.minutos_acumulados,
                                'xpPendente', f.xp_pendente,
                                'moedaPendente', f.moeda_pendente,
                                'minutosAnuncioSaldo', f.minutos_anuncio_saldo,
                                'ultimaSessao', f.last_seen_at)
        from public.farm_state f where f.player_id = v_uid
    ),
    -- Estado da assinatura, sem a referência do gateway: ela é dado do
    -- provedor, não do jogador, e não entra na exportação pelo mesmo motivo
    -- que não entra no grant.
    'assinatura', (
      select jsonb_build_object('status', s.status, 'expiraEm', s.expira_em)
        from public.assinatura s where s.player_id = v_uid
    ),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', i.tipo, 'raridade', i.raridade,
                                          'fortificacao', i.fortificacao,
                                          'slot', i.slot, 'obtidoEm', i.obtido_em)
                       order by i.obtido_em)
        from public.item_jogador i where i.player_id = v_uid
    ), '[]'::jsonb),
    'eventos', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', e.tipo, 'dados', e.dados,
                                          'em', e.criado_em)
                       order by e.criado_em)
        from public.evento_jogo e where e.player_id = v_uid
    ), '[]'::jsonb)
  )
    into v_out
    from public.jogador j
   where j.id = v_uid;

  if v_out is null then
    raise exception 'JOGADOR_INEXISTENTE';
  end if;

  return v_out;
end;
$$;

revoke execute on function public.exportar_meus_dados() from public;
grant execute on function public.exportar_meus_dados() to authenticated;

comment on function public.exportar_meus_dados() is
  'LGPD — direito de acesso. Sem parâmetro: opera só sobre auth.uid(), então não alcança conta alheia.';

-- ============================================================================
-- excluir_minha_conta — LGPD, direito de eliminação
--
-- Apaga a linha de `auth.users`, e o `on delete cascade` de `jogador` leva
-- junto farm, atributos, itens, assinatura, tickets, eventos e a linha do
-- ranking. Apagar em cascata em vez de listar tabela por tabela é a escolha
-- certa aqui: uma tabela nova criada amanhã já nasce coberta, enquanto uma
-- lista precisaria ser lembrada.
--
-- É IRREVERSÍVEL, e não existe versão "desativar": meia-exclusão que guarda o
-- dado "por precaução" é exatamente o que a LGPD não aceita.
-- ============================================================================
create or replace function public.excluir_minha_conta()
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

  if not exists (select 1 from public.jogador where id = v_uid) then
    raise exception 'JOGADOR_INEXISTENTE';
  end if;

  -- Uma linha só. `jogador` referencia `auth.users` com `on delete cascade`, e
  -- todas as demais tabelas referenciam `jogador` do mesmo jeito — inclusive
  -- `ranking_posicao`, que é a única com dado visível para terceiros. O teste
  -- de fumaça confere tabela por tabela que não sobrou nada.
  delete from auth.users where id = v_uid;

  return jsonb_build_object('excluida', true);
end;
$$;

revoke execute on function public.excluir_minha_conta() from public;
grant execute on function public.excluir_minha_conta() to authenticated;

comment on function public.excluir_minha_conta() is
  'LGPD — direito de eliminação. Sem parâmetro: opera só sobre auth.uid(). Irreversível, sem estado intermediário de "desativada".';
