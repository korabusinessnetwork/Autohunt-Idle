-- ============================================================================
-- Teste de fumaça das migrations, contra um Postgres de verdade.
--
-- Complementa `src/lib/contratoRpc.test.ts`, que audita o TEXTO do SQL. Este
-- aqui EXECUTA: pega erro de tipo, constraint que não pega, índice parcial que
-- não aplica, forma fechada que diverge do somatório — nada disso um teste de
-- leitura de arquivo consegue ver.
--
-- Como rodar (ver `scripts/pg-local.sh`):
--   psql -d autohunt -f scripts/stub-supabase.sql
--   psql -d autohunt -f supabase/migrations/*.sql
--   psql -d autohunt -v ON_ERROR_STOP=1 -f scripts/teste-migrations.sql
--
-- Qualquer falha levanta exceção e derruba o script.
-- ============================================================================

\set ON_ERROR_STOP on

create or replace function public.checar(p_condicao boolean, p_nome text)
returns void language plpgsql as $$
begin
  if not p_condicao then
    raise exception 'FALHOU: %', p_nome;
  end if;
  raise notice '  ok  %', p_nome;
end;
$$;

-- ---------------------------------------------------------------------------
-- Matemática pura
-- ---------------------------------------------------------------------------
\echo '== matemática =='
do $$
declare v_n bigint; v_soma bigint; v_i integer;
begin
  -- Curva de XP: a inversa precisa bater com a direta em qualquer nível.
  foreach v_n in array array[1, 2, 7, 50, 999, 12345, 100000]::bigint[] loop
    perform public.checar(
      public.nivel_por_xp(public.xp_acumulado_para_nivel(v_n)::bigint) = v_n,
      format('nivel_por_xp inverte a curva no nível %s', v_n));
  end loop;

  perform public.checar(public.nivel_por_xp(0) = 1, 'XP zero é nível 1');
  perform public.checar(public.nivel_por_xp(99) = 1, 'XP 99 ainda é nível 1');
  perform public.checar(public.nivel_por_xp(100) = 2, 'XP 100 vira nível 2');

  -- Custo de atributo: a forma fechada precisa bater com o somatório real.
  v_soma := 0;
  for v_i in 0 .. 250 loop
    perform public.checar(public.custo_acumulado_atributo(v_i) = v_soma,
                          format('custo acumulado fecha no nível %s', v_i));
    v_soma := v_soma + public.custo_proximo_nivel_atributo(v_i);
  end loop;

  -- A regra que a prosa da spec contradizia: subir de 10 para 11 custa 2.
  perform public.checar(public.custo_proximo_nivel_atributo(9) = 1, 'subir para +10 custa 1');
  perform public.checar(public.custo_proximo_nivel_atributo(10) = 2, 'subir de 10 para 11 custa 2');

  -- Sorteio determinístico: mesma semente, mesmo número, sempre em [0,1).
  perform public.checar(public.sorteio01('a') = public.sorteio01('a'), 'sorteio é determinístico');
  perform public.checar(public.sorteio01('a') <> public.sorteio01('b'), 'sementes diferentes divergem');
  perform public.checar(public.sorteio01('x') >= 0 and public.sorteio01('x') < 1,
                        'sorteio fica em [0,1)');

  -- Piso de raridade é garantia, não sorteio.
  perform public.checar(public.escalar_raridade('qualquer', 3::smallint, 10::smallint, 0) >= 3,
                        'boss garante piso raro');
  perform public.checar(public.escalar_raridade('qualquer', 2::smallint, 3::smallint, 9999) <= 3,
                        'mini boss respeita o teto raro');

  -- Fortificação: chance nunca sobe, custo sempre cresce.
  for v_i in 0 .. 14 loop
    perform public.checar(
      public.chance_de_fortificar(v_i + 1) <= public.chance_de_fortificar(v_i),
      format('chance de fortificar não sobe de %s para %s', v_i, v_i + 1));
    perform public.checar(
      public.custo_de_fortificar(v_i + 1, 5) > public.custo_de_fortificar(v_i, 5),
      format('custo de fortificar cresce de %s para %s', v_i, v_i + 1));
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Fluxo de sessão
-- ---------------------------------------------------------------------------
\echo '== sessão e farm =='
do $$
declare
  v_uid  uuid := '11111111-1111-1111-1111-111111111111';
  v_snap jsonb;
  v_xp   bigint;
begin
  insert into auth.users (id, email) values (v_uid, null);
  perform set_config('autohunt.uid', v_uid::text, false);

  v_snap := public.iniciar_sessao();
  perform public.checar((v_snap ->> 'existe')::boolean, 'primeira sessão cria o jogador');
  perform public.checar((v_snap #>> '{jogador,nivel}')::bigint = 1, 'começa no nível 1');
  perform public.checar((v_snap #>> '{retorno,houveAusencia}')::boolean = false,
                        'primeira sessão não é ausência');

  -- Arma inicial: o personagem nunca fica sem nada equipado (core do
  -- equipamento, critério 8).
  perform public.checar(
    exists (select 1 from public.item_jogador
             where player_id = v_uid and tipo = 'arma' and slot = 'arma'),
    'ganha arma inicial equipada');

  -- Ausência de 3h. Sem assinatura e sem anúncio, o teto é zero.
  update public.farm_state set last_seen_at = now() - interval '3 hours' where player_id = v_uid;
  v_snap := public.iniciar_sessao();
  perform public.checar((v_snap #>> '{retorno,motivo}') = 'sem_desbloqueio',
                        'sem desbloqueio não credita nada');
  perform public.checar((v_snap #>> '{retorno,minutosCreditados}')::integer = 0,
                        'não-assinante acumula 0h por padrão');

  -- Com saldo de anúncio, credita só até onde o saldo cobre.
  update public.farm_state
     set minutos_anuncio_saldo = 60, last_seen_at = now() - interval '3 hours'
   where player_id = v_uid;
  v_snap := public.iniciar_sessao();
  perform public.checar((v_snap #>> '{retorno,minutosCreditados}')::integer = 60,
                        'credita exatamente o saldo de anúncio');
  perform public.checar((v_snap #>> '{retorno,motivo}') = 'teto_anuncio',
                        'motivo indica o teto do anúncio');
  perform public.checar((v_snap #>> '{farm,minutosAnuncioSaldo}')::integer = 0,
                        'saldo de anúncio é consumido');

  v_xp := (v_snap #>> '{farm,xpPendente}')::bigint;
  perform public.checar(v_xp > 0, 'farm offline gera XP pendente');

  -- Coleta move o pendente para o total e sobe de nível.
  v_snap := public.coletar_farm_offline();
  perform public.checar((v_snap #>> '{farm,xpPendente}')::bigint = 0, 'coleta zera o pendente');
  perform public.checar((v_snap #>> '{jogador,xpTotal}')::bigint >= v_xp,
                        'XP coletado entra no total');
  perform public.checar((v_snap #>> '{jogador,nivel}')::bigint > 1, 'jogador subiu de nível');

  -- Auto-alocação: quem nunca abriu a tela de atributos tem build coerente.
  perform public.checar((v_snap #>> '{atributos,forca}')::integer > 0,
                        'pontos foram auto-alocados');
  perform public.checar((v_snap #>> '{atributos,pontosLivres}')::integer < 4,
                        'quase nenhum ponto sobra sem gastar');
end $$;

-- ---------------------------------------------------------------------------
-- Assinatura: 24h e 2x XP
-- ---------------------------------------------------------------------------
\echo '== assinatura =='
do $$
declare
  v_uid  uuid := '22222222-2222-2222-2222-222222222222';
  v_snap jsonb;
  v_sem  bigint;
  v_com  bigint;
  v_vit  integer;
begin
  insert into auth.users (id, email) values (v_uid, null);
  perform set_config('autohunt.uid', v_uid::text, false);
  perform public.iniciar_sessao();

  -- A Vitalidade é levada de um ciclo para o outro, e é ela que decide ONDE
  -- caem as derrotas. Duas resoluções seguidas partindo de Vitalidade
  -- diferente rendem números diferentes mesmo com o multiplicador correto —
  -- por isso o ponto de partida precisa ser restaurado antes da comparação.
  select vitalidade_atual into v_vit from public.jogador where id = v_uid;

  update public.farm_state
     set minutos_anuncio_saldo = 120, last_seen_at = now() - interval '2 hours'
   where player_id = v_uid;
  v_snap := public.iniciar_sessao();
  v_sem := (v_snap #>> '{retorno,xpGanho}')::bigint;

  perform public.aplicar_evento_assinatura(v_uid, 'ativa', now() + interval '30 days',
                                           'stripe', 'ref-1');
  update public.jogador set vitalidade_atual = v_vit where id = v_uid;
  -- O saldo de anúncio foi consumido pela rodada anterior; repor deixa o
  -- cenário idêntico e ainda permite provar que o assinante NÃO o gasta.
  update public.farm_state
     set xp_pendente = 0, minutos_anuncio_saldo = 120,
         last_seen_at = now() - interval '2 hours'
   where player_id = v_uid;
  v_snap := public.iniciar_sessao();
  v_com := (v_snap #>> '{retorno,xpGanho}')::bigint;

  perform public.checar(v_com = v_sem * 2, 'assinante recebe exatamente 2x XP');
  perform public.checar((v_snap #>> '{assinatura,tetoOfflineMinutos}')::integer = 1440,
                        'assinante tem teto de 24h');

  -- Assinante não consome saldo de anúncio.
  perform public.checar((v_snap #>> '{farm,minutosAnuncioSaldo}')::integer = 120,
                        'assinante não gasta minutos de anúncio');

  -- Vencer de fato zera o pendente não coletado; cancelar não.
  perform public.aplicar_evento_assinatura(v_uid, 'cancelada', now() + interval '5 days',
                                           'stripe', 'ref-1');
  v_snap := public.iniciar_sessao();
  perform public.checar((v_snap #>> '{assinatura,ativa}')::boolean,
                        'cancelar mantém o benefício até o fim do período pago');

  perform public.aplicar_evento_assinatura(v_uid, 'vencida', now() - interval '1 day',
                                           'stripe', 'ref-1');
  v_snap := public.estado_jogador();
  perform public.checar((v_snap #>> '{farm,xpPendente}')::bigint = 0,
                        'vencer zera o progresso não coletado');
end $$;

-- ---------------------------------------------------------------------------
-- Gate de idade e apelido
-- ---------------------------------------------------------------------------
\echo '== cadastro, idade e apelido =='
do $$
declare
  v_a uuid := '33333333-3333-3333-3333-333333333333';
  v_b uuid := '44444444-4444-4444-4444-444444444444';
  v_erro text;
begin
  insert into auth.users (id, email) values (v_a, 'a@exemplo.com'), (v_b, 'b@exemplo.com');
  perform set_config('autohunt.uid', v_a::text, false);
  perform public.iniciar_sessao();
  perform set_config('autohunt.uid', v_b::text, false);
  perform public.iniciar_sessao();

  -- Menor de idade é bloqueado pelo banco, não só pelo formulário.
  begin
    update public.jogador set data_nascimento = current_date - interval '10 years' where id = v_a;
    perform public.checar(false, 'menor de idade deveria ter sido bloqueado');
  exception when others then
    get stacked diagnostics v_erro = message_text;
    perform public.checar(v_erro = 'IDADE_MINIMA_NAO_ATINGIDA', 'gate de 18+ bloqueia menor');
  end;

  update public.jogador set data_nascimento = current_date - interval '30 years' where id = v_a;
  update public.jogador set data_nascimento = current_date - interval '30 years' where id = v_b;

  -- Data de nascimento é imutável depois de informada.
  begin
    update public.jogador set data_nascimento = current_date - interval '40 years' where id = v_a;
    perform public.checar(false, 'data de nascimento deveria ser imutável');
  exception when others then
    get stacked diagnostics v_erro = message_text;
    perform public.checar(v_erro = 'DATA_NASCIMENTO_IMUTAVEL', 'data de nascimento é imutável');
  end;

  -- Apelido único, sem diferenciar maiúscula.
  perform set_config('autohunt.uid', v_a::text, false);
  perform public.definir_apelido('Duda');

  perform set_config('autohunt.uid', v_b::text, false);
  begin
    perform public.definir_apelido('duda');
    perform public.checar(false, 'apelido duplicado deveria ser recusado');
  exception when others then
    get stacked diagnostics v_erro = message_text;
    perform public.checar(v_erro = 'APELIDO_EM_USO', 'apelido é único, ignorando maiúscula');
  end;

  perform public.definir_apelido('Rafa');
  perform public.checar(
    (public.ranking_global() #>> '{eu,posicao}') is not null,
    'jogador aparece no ranking assim que define apelido');
end $$;

-- Conta anônima (sem e-mail e sem data de nascimento) não entra no placar.
do $$
declare v_c uuid := '55555555-5555-5555-5555-555555555555'; v_erro text;
begin
  insert into auth.users (id, email) values (v_c, null);
  perform set_config('autohunt.uid', v_c::text, false);
  perform public.iniciar_sessao();
  begin
    perform public.definir_apelido('Convidado');
    perform public.checar(false, 'convidado não deveria entrar no placar');
  exception when others then
    get stacked diagnostics v_erro = message_text;
    perform public.checar(v_erro = 'CADASTRO_NECESSARIO', 'placar exige identidade permanente');
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Loot, dungeon, síntese e fortificação
-- ---------------------------------------------------------------------------
\echo '== loot, dungeon, síntese e fortificação =='
do $$
declare
  v_uid   uuid := '66666666-6666-6666-6666-666666666666';
  v_snap  jsonb;
  v_item  uuid;
  v_antes integer;
  v_erro  text;
  v_i     integer;
begin
  insert into auth.users (id, email) values (v_uid, 'f@exemplo.com');
  perform set_config('autohunt.uid', v_uid::text, false);
  perform public.iniciar_sessao();

  -- Ausência longa com assinatura: gera loot, chaves e resolve dungeons.
  perform public.aplicar_evento_assinatura(v_uid, 'ativa', now() + interval '30 days',
                                           'stripe', 'ref-2');
  update public.farm_state set last_seen_at = now() - interval '20 hours' where player_id = v_uid;
  v_snap := public.iniciar_sessao();

  perform public.checar((v_snap #>> '{retorno,drops,miniBosses}')::integer > 0,
                        'mini boss aparece durante a ausência');
  perform public.checar((v_snap #>> '{retorno,dungeons,resolvidas}')::integer > 0,
                        'dungeons acumuladas são resolvidas no servidor');
  perform public.checar((v_snap #>> '{retorno,dungeons,resolvidas}')::integer <= 10,
                        'teto de 10 dungeons por retorno é respeitado');

  -- Loot de dungeon vencida nunca sai abaixo de raro.
  perform public.checar(
    not exists (select 1 from public.item_jogador
                 where player_id = v_uid and origem = 'dungeon' and raridade < 1),
    'todo item de dungeon tem raridade válida');

  -- Síntese: 9 iguais viram 1 do tier acima, e a conta fecha.
  insert into public.item_jogador (player_id, tipo, raridade, origem)
  select v_uid, 'capacete', 2, 'mundo' from generate_series(1, 9);
  v_antes := (select count(*) from public.item_jogador
               where player_id = v_uid and tipo = 'capacete' and raridade = 2);
  v_snap := public.sintetizar('capacete', 2::smallint);
  perform public.checar((v_snap #>> '{sintese,consumidos}')::integer = 9, 'síntese consome 9');
  perform public.checar((v_snap #>> '{sintese,produziuRaridade}')::integer > 2,
                        'síntese produz raridade superior');
  perform public.checar(
    (select count(*) from public.item_jogador
      where player_id = v_uid and tipo = 'capacete' and raridade = 2) = v_antes - 9,
    'os 9 itens sumiram do inventário');

  -- Síntese sem itens suficientes é recusada, sem consumir nada.
  begin
    perform public.sintetizar('bota', 9::smallint);
    perform public.checar(false, 'síntese sem itens deveria falhar');
  exception when others then
    get stacked diagnostics v_erro = message_text;
    perform public.checar(v_erro = 'ITENS_INSUFICIENTES', 'síntese recusa sem 9 itens');
  end;

  -- Fortificação: sucesso sobe, falha nunca rebaixa.
  update public.jogador set moeda = 100000000 where id = v_uid;
  insert into public.item_jogador (player_id, tipo, raridade, origem)
  select v_uid, 'pedra_fortificacao', 1, 'mundo' from generate_series(1, 60);

  select id into v_item from public.item_jogador
   where player_id = v_uid and tipo = 'arma' limit 1;

  for v_i in 1 .. 40 loop
    v_antes := (select fortificacao from public.item_jogador where id = v_item);
    begin
      v_snap := public.fortificar_item(v_item);
      perform public.checar(
        (select fortificacao from public.item_jogador where id = v_item) >= v_antes,
        'fortificação nunca cai');
    exception when others then
      get stacked diagnostics v_erro = message_text;
      exit when v_erro in ('TETO_ATINGIDO', 'SEM_PEDRA', 'OURO_INSUFICIENTE');
      raise;
    end;
  end loop;

  perform public.checar(
    (select fortificacao from public.item_jogador where id = v_item) > 0,
    'alguma tentativa de fortificação deu certo');

  -- Fortificar skin é recusado: skin não tem stat.
  insert into public.item_jogador (player_id, tipo, raridade, origem)
  values (v_uid, 'skin', 3, 'dungeon') returning id into v_item;
  begin
    perform public.fortificar_item(v_item);
    perform public.checar(false, 'fortificar skin deveria falhar');
  exception when others then
    get stacked diagnostics v_erro = message_text;
    perform public.checar(v_erro = 'ITEM_NAO_FORTIFICAVEL', 'skin não pode ser fortificada');
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Skin não altera número nenhum
-- ---------------------------------------------------------------------------
\echo '== skin é puramente cosmética =='
do $$
declare
  v_uid   uuid := '77777777-7777-7777-7777-777777777777';
  v_skin  uuid;
  v_antes integer;
begin
  insert into auth.users (id, email) values (v_uid, 's@exemplo.com');
  perform set_config('autohunt.uid', v_uid::text, false);
  perform public.iniciar_sessao();

  v_antes := public.poder_de_ataque(v_uid);

  insert into public.item_jogador (player_id, tipo, raridade, origem)
  values (v_uid, 'skin', 10, 'dungeon') returning id into v_skin;
  perform public.equipar_item(v_skin);

  -- A skin mais rara do jogo, equipada, não muda um único ponto de poder.
  perform public.checar(public.poder_de_ataque(v_uid) = v_antes,
                        'skin cósmica equipada não altera o poder de ataque');
end $$;

-- ---------------------------------------------------------------------------
-- Slots, sinergia e conjunto
-- ---------------------------------------------------------------------------
\echo '== equipamento =='
do $$
declare
  v_uid   uuid := '88888888-8888-8888-8888-888888888888';
  v_arma  uuid;
  v_cap   uuid;
  v_arm   uuid;
  v_base  integer;
  v_sin   integer;
  v_conj  integer;
  v_erro  text;
begin
  insert into auth.users (id, email) values (v_uid, 'e@exemplo.com');
  perform set_config('autohunt.uid', v_uid::text, false);
  perform public.iniciar_sessao();

  delete from public.item_jogador where player_id = v_uid;

  insert into public.item_jogador (player_id, tipo, raridade, origem, tipo_dano)
  values (v_uid, 'arma', 8, 'dungeon', 'magico') returning id into v_arma;
  insert into public.item_jogador (player_id, tipo, raridade, origem, afinidade)
  values (v_uid, 'capacete', 8, 'dungeon', 'fisico') returning id into v_cap;

  perform public.equipar_item(v_arma);
  perform public.equipar_item(v_cap);
  v_base := public.poder_de_ataque(v_uid);

  -- Trocar o capacete por um de afinidade mágica (a mesma da arma) precisa
  -- render mais, com a mesma raridade.
  delete from public.item_jogador where id = v_cap;
  insert into public.item_jogador (player_id, tipo, raridade, origem, afinidade)
  values (v_uid, 'capacete', 8, 'dungeon', 'magico') returning id into v_cap;
  perform public.equipar_item(v_cap);
  v_sin := public.poder_de_ataque(v_uid);

  perform public.checar(v_sin > v_base, 'afinidade batendo com a arma rende mais');

  -- Duas peças do mesmo conjunto ativam o bônus.
  update public.item_jogador set conjunto_id = 'bruxa-caramelo' where id in (v_arma, v_cap);
  v_conj := public.poder_de_ataque(v_uid);
  perform public.checar(v_conj > v_sin, 'bônus de 2 peças de conjunto aplica');

  -- Um item só cabe no slot do próprio tipo.
  insert into public.item_jogador (player_id, tipo, raridade, origem)
  values (v_uid, 'chave', 1, 'mundo') returning id into v_arm;
  begin
    perform public.equipar_item(v_arm);
    perform public.checar(false, 'chave não deveria ser equipável');
  exception when others then
    get stacked diagnostics v_erro = message_text;
    perform public.checar(v_erro = 'ITEM_NAO_EQUIPAVEL', 'chave não é equipável');
  end;

  -- Um item por slot: o índice único é quem garante.
  perform public.checar(
    (select count(*) from public.item_jogador
      where player_id = v_uid and slot = 'arma') <= 1,
    'no máximo uma arma equipada');
end $$;

-- ---------------------------------------------------------------------------
-- Permissões: o jogador não alcança o que é do servidor
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Loja de ouro: diamante vira ouro em quantidade fixa, e nada além disso
-- ---------------------------------------------------------------------------
\echo '== loja de ouro =='
do $$
declare
  v_uid       uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_pacote    public.pacote_ouro%rowtype;
  v_ouro_ini  bigint;
  v_diam_ini  bigint;
  v_snap      jsonb;
  v_erro      text;
begin
  insert into auth.users (id, email) values (v_uid, 'loja@exemplo.com');
  perform set_config('autohunt.uid', v_uid::text, false);
  perform public.iniciar_sessao();

  select * into v_pacote from public.pacote_ouro where id = 'punhado';

  -- Sem diamante nenhum: recusa, e não consome nada.
  v_ouro_ini := (select moeda from public.jogador where id = v_uid);
  begin
    perform public.comprar_ouro('punhado');
    perform public.checar(false, 'compra sem saldo deveria falhar');
  exception when others then
    get stacked diagnostics v_erro = message_text;
    perform public.checar(v_erro = 'DIAMANTE_INSUFICIENTE', 'compra sem diamante é recusada');
  end;
  perform public.checar(
    (select moeda from public.jogador where id = v_uid) = v_ouro_ini,
    'compra recusada não credita ouro');

  -- Saldo exato: permitido, e deixa o saldo em zero (edge case da spec).
  update public.jogador set diamante = v_pacote.diamantes where id = v_uid;
  v_ouro_ini := (select moeda from public.jogador where id = v_uid);

  v_snap := public.comprar_ouro('punhado');

  perform public.checar(
    (select diamante from public.jogador where id = v_uid) = 0,
    'compra com saldo exato zera o diamante');
  -- A prova central do critério 3: a quantidade é EXATAMENTE a publicada.
  perform public.checar(
    (select moeda from public.jogador where id = v_uid) = v_ouro_ini + v_pacote.ouro,
    'o ouro creditado é exatamente o do pacote');
  perform public.checar(
    (v_snap #>> '{compra,ouroRecebido}')::bigint = v_pacote.ouro,
    'o snapshot devolve a quantidade que o servidor creditou');
  perform public.checar(
    (v_snap #>> '{jogador,diamante}')::bigint = 0,
    'o snapshot expõe o saldo de diamante');
  perform public.checar(
    jsonb_array_length(v_snap -> 'lojaOuro') = 3,
    'o snapshot publica o catálogo da loja');

  -- Pacote desativado é recusado mesmo com saldo de sobra.
  update public.jogador set diamante = 10000 where id = v_uid;
  update public.pacote_ouro set ativo = false where id = 'bau';
  begin
    perform public.comprar_ouro('bau');
    perform public.checar(false, 'pacote desativado deveria falhar');
  exception when others then
    get stacked diagnostics v_erro = message_text;
    perform public.checar(v_erro = 'PACOTE_INDISPONIVEL', 'pacote desativado é recusado');
  end;
  update public.pacote_ouro set ativo = true where id = 'bau';

  -- O saldo nunca fica negativo, nem por caminho direto.
  begin
    update public.jogador set diamante = -1 where id = v_uid;
    perform public.checar(false, 'saldo negativo de diamante deveria ser impossível');
  exception when check_violation then
    perform public.checar(true, 'o saldo de diamante nunca fica negativo');
  end;

  -- Vencer a dungeon é a fonte GRATUITA — é o que sustenta a condição de
  -- compliance da fortificação.
  v_diam_ini := (select diamante from public.jogador where id = v_uid);
  insert into public.item_jogador (player_id, tipo, raridade, origem)
  values (v_uid, 'chave', 1, 'mundo');
  -- Poder alto o bastante para a vitória ser certa neste nível.
  update public.atributo_jogador set forca = 400 where player_id = v_uid;

  v_snap := public.resolver_uma_dungeon(v_uid);
  if (v_snap ->> 'venceu')::boolean then
    perform public.checar(
      (select diamante from public.jogador where id = v_uid) > v_diam_ini,
      'derrotar o boss concede diamante');
  else
    perform public.checar(
      (select diamante from public.jogador where id = v_uid) = v_diam_ini,
      'perder a dungeon não concede diamante');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Passe: progresso por jogar, recompensa específica, nada expira, nada é tirado
-- ---------------------------------------------------------------------------
\echo '== passe de recompensas =='
do $$
declare
  v_uid      uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  v_sem      uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  v_snap     jsonb;
  v_itens    bigint;
  v_pontos   bigint;
  v_tier     integer;
  v_esperado public.passe_recompensa%rowtype;
begin
  insert into auth.users (id, email) values (v_uid, 'passe@exemplo.com'), (v_sem, null);

  -- --- Sem passe, jogar não dá ponto (critério 4) ---
  perform set_config('autohunt.uid', v_sem::text, false);
  perform public.iniciar_sessao();
  perform public.creditar_ciclos(v_sem, 500, 1, false);
  perform public.checar(
    coalesce((select pontos from public.passe_jogador where player_id = v_sem), 0) = 0,
    'sem passe ativo, jogar não acumula ponto');

  -- --- Com passe, o progresso vem de jogar ---
  perform set_config('autohunt.uid', v_uid::text, false);
  perform public.iniciar_sessao();

  v_snap := public.montar_snapshot(v_uid);
  perform public.checar((v_snap #>> '{passe,ativo}')::boolean = false,
                        'o passe começa desativado');
  -- A trilha inteira aparece MESMO sem ter comprado: é o que permite ver o que
  -- se está comprando antes de pagar.
  perform public.checar(jsonb_array_length(v_snap #> '{passe,trilha}') = 12,
                        'a trilha inteira é publicada antes da compra');

  perform public.ativar_passe(v_uid, 'ref-passe-1');
  perform public.creditar_ciclos(v_uid, 150, 1, false);

  select pontos, tier into v_pontos, v_tier
    from public.passe_jogador where player_id = v_uid;
  perform public.checar(v_pontos = 150, 'jogar com passe ativo acumula ponto');
  perform public.checar(v_tier = 1, 'cruzar o primeiro tier concede sozinho, sem resgatar');

  -- --- A recompensa é EXATAMENTE a publicada (critério 6) ---
  select * into v_esperado from public.passe_recompensa where tier = 1;
  perform public.checar(
    exists (select 1 from public.item_jogador
             where player_id = v_uid and origem = 'passe'
               and tipo = v_esperado.tipo and raridade = v_esperado.raridade),
    'a recompensa concedida é exatamente a que a trilha publicava');

  -- --- Vários tiers de uma vez, sem pular nenhum (edge case) ---
  -- 150 + 1000 = 1150 pontos. A trilha pede 100/300/600/1000 nos quatro
  -- primeiros tiers e 1500 no quinto: cruza até o 4, e para exatamente ali.
  perform public.creditar_ciclos(v_uid, 1000, 1, false);
  select tier into v_tier from public.passe_jogador where player_id = v_uid;
  perform public.checar(v_tier = 4, 'uma ausência longa concede vários tiers de uma vez');
  perform public.checar(
    (select count(*) from public.item_jogador
      where player_id = v_uid and origem = 'passe') = 4,
    'nenhum tier é pulado — um item por tier cruzado');
  perform public.checar(
    not exists (select 1 from public.passe_recompensa r
                 where r.tier <= v_tier
                   and not exists (select 1 from public.item_jogador i
                                    where i.player_id = v_uid and i.origem = 'passe'
                                      and i.tipo = r.tipo and i.raridade = r.raridade)),
    'todo tier cruzado entregou a recompensa que publicava');

  -- --- Desativar não tira nada, e congela o progresso (critérios 4 e 8) ---
  select count(*) into v_itens
    from public.item_jogador where player_id = v_uid and origem = 'passe';

  perform public.desativar_passe(v_uid);
  perform public.creditar_ciclos(v_uid, 5000, 1, false);

  perform public.checar(
    (select count(*) from public.item_jogador
      where player_id = v_uid and origem = 'passe') = v_itens,
    'desativar o passe não retira nenhuma recompensa já destravada');
  perform public.checar(
    (select pontos from public.passe_jogador where player_id = v_uid) = 1150,
    'passe desativado para de acumular ponto');
  perform public.checar(
    (select tier from public.passe_jogador where player_id = v_uid) = 4,
    'passe desativado não regride o tier');

  -- --- Reativar retoma do mesmo ponto, sem zerar ---
  perform public.ativar_passe(v_uid);
  perform public.creditar_ciclos(v_uid, 400, 1, false);
  perform public.checar(
    (select pontos from public.passe_jogador where player_id = v_uid) = 1550,
    'reativar retoma de onde parou, sem zerar');

  -- --- A skin exclusiva só sai da trilha (critério 9) ---
  perform public.checar(
    not exists (select 1 from public.item_jogador
                 where exclusivo_do_passe and origem <> 'passe'),
    'nenhuma rota fora do passe concede item exclusivo');

  -- --- O passe é independente da assinatura (critério 1) ---
  -- Ter passe não torna ninguém assinante…
  v_snap := public.montar_snapshot(v_uid);
  perform public.checar((v_snap #>> '{passe,ativo}')::boolean,
                        'o passe está ativo');
  perform public.checar((v_snap #>> '{assinatura,ativa}')::boolean = false,
                        'ter passe não torna o jogador assinante');
  perform public.checar((v_snap #>> '{assinatura,multiplicadorXp}')::integer = 1,
                        'o passe não dá o 2x XP da assinatura');

  -- …e assinar não mexe no passe, nem cancelar a assinatura o desliga.
  perform public.aplicar_evento_assinatura(v_uid, 'ativa', now() + interval '30 days',
                                           'stripe', 'ref-passe-ass');
  select tier into v_tier from public.passe_jogador where player_id = v_uid;
  perform public.aplicar_evento_assinatura(v_uid, 'vencida', now() - interval '1 day',
                                           'stripe', 'ref-passe-ass');
  v_snap := public.montar_snapshot(v_uid);
  perform public.checar((v_snap #>> '{passe,ativo}')::boolean,
                        'a assinatura vencer não desliga o passe');
  perform public.checar((v_snap #>> '{passe,tier}')::integer = v_tier,
                        'a assinatura vencer não mexe no tier do passe');

  -- --- E entra na exportação de LGPD ---
  v_snap := public.exportar_meus_dados();
  perform public.checar((v_snap #>> '{passe,tier}')::integer = 5,
                        'a exportação de dados inclui o progresso do passe');
end $$;

-- ---------------------------------------------------------------------------
-- LGPD: exportar e excluir os próprios dados
-- ---------------------------------------------------------------------------
\echo '== dados pessoais (LGPD) =='
do $$
declare
  v_eu     uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_outro  uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_anon   uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  v_json   jsonb;
  v_erro   text;
  v_tabela text;
  v_sobrou bigint;
begin
  insert into auth.users (id, email) values
    (v_eu, 'eu@exemplo.com'), (v_outro, 'outro@exemplo.com'), (v_anon, null);

  -- Dois jogadores com progresso visivelmente diferente, para a exportação não
  -- poder "acertar por coincidência".
  perform set_config('autohunt.uid', v_outro::text, false);
  perform public.iniciar_sessao();
  update public.jogador set nivel = 99, moeda = 777 where id = v_outro;

  perform set_config('autohunt.uid', v_eu::text, false);
  perform public.iniciar_sessao();
  update public.jogador set nivel = 7, moeda = 42, diamante = 5 where id = v_eu;

  -- --- Exportar ---
  v_json := public.exportar_meus_dados();

  perform public.checar((v_json #>> '{conta,email}') = 'eu@exemplo.com',
                        'a exportação traz o e-mail da própria conta');
  perform public.checar((v_json #>> '{progresso,nivel}')::bigint = 7,
                        'a exportação traz o progresso de quem chamou');
  perform public.checar((v_json #>> '{progresso,diamante}')::bigint = 5,
                        'a exportação inclui o saldo de diamante');
  -- A prova de isolamento: o dado do outro jogador não aparece em lugar nenhum
  -- do JSON. Sem `player_id` na assinatura, não há nem como pedir.
  perform public.checar(v_json::text not like '%777%',
                        'a exportação não vaza dado de outro jogador');

  foreach v_tabela in array array['conta', 'progresso', 'atributos', 'farm',
                                  'assinatura', 'itens', 'eventos'] loop
    perform public.checar(v_json ? v_tabela,
                          format('a exportação inclui a seção %s', v_tabela));
  end loop;

  -- Exportar não pode ter efeito colateral no progresso.
  perform public.checar(
    (select moeda from public.jogador where id = v_eu) = 42,
    'exportar não credita nem coleta nada');

  -- Conta anônima exporta igual, só com e-mail nulo (edge case da spec).
  perform set_config('autohunt.uid', v_anon::text, false);
  perform public.iniciar_sessao();
  v_json := public.exportar_meus_dados();
  perform public.checar(v_json #>> '{conta,email}' is null,
                        'conta anônima exporta com e-mail nulo, sem falhar');
  perform public.checar(v_json #>> '{conta,dataNascimento}' is null,
                        'conta anônima exporta sem data de nascimento');

  -- --- Excluir ---
  perform set_config('autohunt.uid', v_eu::text, false);
  -- Entrar no placar exige identidade verificada (e-mail + data de
  -- nascimento). É só assim que existe linha em `ranking_posicao` para a
  -- exclusão ter que apagar.
  update public.jogador set data_nascimento = date '1990-01-01' where id = v_eu;
  perform public.definir_apelido('ApagaEu');
  perform public.recomputar_ranking();
  perform public.checar(
    exists (select 1 from public.ranking_posicao where player_id = v_eu),
    'o jogador está no placar antes de apagar');

  v_json := public.excluir_minha_conta();
  perform public.checar((v_json ->> 'excluida')::boolean, 'a exclusão confirma');

  -- Nada pode sobrar, em tabela nenhuma — inclusive a única com dado visível
  -- para terceiros.
  foreach v_tabela in array array['jogador', 'farm_state', 'assinatura',
                                  'atributo_jogador', 'item_jogador',
                                  'evento_jogo', 'ticket_anuncio',
                                  'ranking_posicao', 'passe_jogador'] loop
    execute format('select count(*) from public.%I where %I = $1',
                   v_tabela,
                   case when v_tabela = 'jogador' then 'id' else 'player_id' end)
       into v_sobrou using v_eu;
    perform public.checar(v_sobrou = 0, format('a exclusão não deixa órfão em %s', v_tabela));
  end loop;

  perform public.checar(
    not exists (select 1 from auth.users where id = v_eu),
    'a exclusão apaga a própria linha de auth.users');

  -- E o vizinho continua intacto: apagar a própria conta não toca em ninguém.
  perform public.checar(
    (select nivel from public.jogador where id = v_outro) = 99,
    'apagar a própria conta não afeta outro jogador');

  -- Chamar de novo, já apagado, é recusado sem estourar nada.
  begin
    perform public.excluir_minha_conta();
    perform public.checar(false, 'excluir conta inexistente deveria falhar');
  exception when others then
    get stacked diagnostics v_erro = message_text;
    perform public.checar(v_erro = 'JOGADOR_INEXISTENTE',
                          'excluir conta já apagada é recusado');
  end;
end $$;

-- ---------------------------------------------------------------------------
-- A superfície de sorteio está mesmo fechada
--
-- Estes checks existem por causa de um furo real (ver a migration
-- 20260823): `sorteio01` e `contador_sorteio` estavam alcançáveis pelo client,
-- e juntos permitiam prever o loot e re-rolar queimando o contador numa ação
-- barata.
-- ---------------------------------------------------------------------------
\echo '== superfície de sorteio =='
do $$
declare
  v_nome text;
  v_a numeric;
  v_b numeric;
begin
  -- Nenhuma função de sorteio, de piso de raridade ou de concessão pode ser
  -- alcançada pelo jogador. Não basta não estar no grant: o Postgres concede
  -- EXECUTE a PUBLIC por padrão, então o que vale é a pergunta ao banco.
  foreach v_nome in array array[
    'public.sorteio01(text)',
    'public.escalar_raridade(text, smallint, smallint, integer)',
    'public.sortear_pedra(text)',
    'public.sortear_tipo_equipamento(text)',
    'public.conceder_item(uuid, text, smallint, smallint, text, integer)',
    'public.conceder_recompensa_passe(uuid, integer)',
    'public.progredir_passe(uuid, bigint)',
    'public.montar_snapshot(uuid)',
    'public.creditar_ciclos(uuid, integer, integer, boolean)'
  ] loop
    perform public.checar(
      not has_function_privilege('authenticated', v_nome, 'execute'),
      format('authenticated NÃO alcança %s', v_nome));
    perform public.checar(
      not has_function_privilege('anon', v_nome, 'execute'),
      format('anon NÃO alcança %s', v_nome));
  end loop;

  -- E o contador, que é a outra metade da semente, saiu da vista.
  perform public.checar(
    not has_column_privilege('authenticated', 'public.farm_state', 'contador_sorteio', 'SELECT'),
    'authenticated não lê farm_state.contador_sorteio');
  -- As colunas que o client de fato usa continuam legíveis.
  perform public.checar(
    has_column_privilege('authenticated', 'public.farm_state', 'xp_pendente', 'SELECT'),
    'authenticated continua lendo farm_state.xp_pendente');

  -- O tempero é inalcançável, e é ele que torna a fórmula inútil sem o
  -- servidor.
  perform public.checar(
    not has_table_privilege('authenticated', 'public.segredo_rng', 'SELECT'),
    'authenticated não lê o tempero do RNG');

  -- A LISTA FECHADA: o que `authenticated` alcança é exatamente o contrato
  -- publicado em `docs/07_APIS/`. Não é "nenhuma das proibidas" — é "estas, e
  -- só estas". Uma função nova que vaze por omissão reprova aqui.
  perform public.checar(
    (select array_agg(p.proname order by p.proname)
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname <> 'checar'
        and has_function_privilege('authenticated', p.oid, 'execute'))
    = array[
      'coletar_farm_offline', 'comprar_ouro', 'definir_ajuste', 'definir_apelido',
      'e_admin', 'emitir_ticket_anuncio', 'emitir_ticket_auto', 'encerrar_sessao',
      'equipar_item', 'estado_jogador', 'excluir_minha_conta', 'exportar_meus_dados',
      'fortificar_item', 'iniciar_dungeon', 'iniciar_sessao', 'ranking_global',
      'reativar_auto_alocacao', 'redistribuir_atributos', 'sintetizar',
      'validar_lote'
    ]::name[],
    'a superfície do client é exatamente a lista declarada');

  -- O sorteio continua determinístico — a correção não trocou previsível por
  -- instável, trocou previsível-por-qualquer-um por previsível-só-pelo-servidor.
  v_a := public.sorteio01('mesma-semente');
  v_b := public.sorteio01('mesma-semente');
  perform public.checar(v_a = v_b, 'o sorteio continua determinístico depois do tempero');
  perform public.checar(v_a >= 0 and v_a < 1, 'o sorteio temperado continua em [0,1)');
  perform public.checar(
    public.sorteio01('a') <> public.sorteio01('b'),
    'sementes diferentes continuam divergindo');
end $$;

\echo '== permissões =='
do $$
declare v_privilegiadas text[] := array[
  'creditar_anuncio', 'aplicar_evento_assinatura', 'resgatar_anuncio_do_jogador',
  'conceder_item', 'resolver_drops', 'creditar_ciclos', 'resolver_uma_dungeon',
  'resolver_dungeons', 'poder_de_ataque', 'auto_alocar_atributos', 'recomputar_ranking',
  'creditar_diamante', 'ativar_passe', 'desativar_passe', 'progredir_passe',
  'conceder_recompensa_passe'
];
  v_nome text;
begin
  foreach v_nome in array v_privilegiadas loop
    perform public.checar(
      not exists (
        select 1 from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = v_nome
           and has_function_privilege('authenticated', p.oid, 'execute')
      ),
      format('authenticated NÃO alcança %s', v_nome));
  end loop;

  -- E as que ele precisa alcançar, ele alcança.
  foreach v_nome in array array['iniciar_sessao', 'validar_lote', 'coletar_farm_offline',
                                'emitir_ticket_anuncio', 'redistribuir_atributos',
                                'definir_apelido', 'ranking_global', 'iniciar_dungeon',
                                'sintetizar', 'equipar_item', 'fortificar_item',
                                'comprar_ouro', 'exportar_meus_dados',
                                'excluir_minha_conta'] loop
    perform public.checar(
      exists (
        select 1 from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = v_nome
           and has_function_privilege('authenticated', p.oid, 'execute')
      ),
      format('authenticated alcança %s', v_nome));
  end loop;

  -- Progressão não é escrita pelo jogador.
  foreach v_nome in array array['nivel', 'xp_total', 'moeda', 'vitalidade_atual', 'apelido'] loop
    perform public.checar(
      not has_column_privilege('authenticated', 'public.jogador', v_nome, 'UPDATE'),
      format('authenticated não escreve jogador.%s', v_nome));
  end loop;

  -- RLS ativa em todas as tabelas.
  perform public.checar(
    not exists (select 1 from pg_tables t
                 join pg_class c on c.relname = t.tablename
                where t.schemaname = 'public' and not c.relrowsecurity),
    'RLS ativa em toda tabela do schema public');
end $$;

-- ---------------------------------------------------------------------------
-- Reconexão rápida não credita duas vezes
-- ---------------------------------------------------------------------------
\echo '== crédito duplo =='
do $$
declare
  v_uid uuid := '99999999-9999-9999-9999-999999999999';
  v_a   bigint;
  v_b   bigint;
begin
  insert into auth.users (id, email) values (v_uid, null);
  perform set_config('autohunt.uid', v_uid::text, false);
  perform public.iniciar_sessao();

  update public.farm_state
     set minutos_anuncio_saldo = 120, last_seen_at = now() - interval '2 hours'
   where player_id = v_uid;

  perform public.iniciar_sessao();
  v_a := (select xp_pendente from public.farm_state where player_id = v_uid);

  -- Segunda chamada imediata: o intervalo já foi consumido.
  perform public.iniciar_sessao();
  v_b := (select xp_pendente from public.farm_state where player_id = v_uid);

  perform public.checar(v_a = v_b, 'reconexão imediata não credita o mesmo intervalo de novo');
end $$;

-- ---------------------------------------------------------------------------
-- Console de ajuste — as duas provas centrais da spec:
--   1. não-admin não escreve ajuste nenhum;
--   2. nenhum ajuste abre caminho para o client declarar ganho.
-- ---------------------------------------------------------------------------
\echo '== console de ajuste =='
do $$
declare
  v_dono   uuid := '10000001-0000-0000-0000-000000000001';
  v_zé     uuid := '10000002-0000-0000-0000-000000000002';
  v_r      jsonb;
  v_valor  numeric;
  v_xp_a   bigint;
  v_xp_b   bigint;
  v_eventos integer;
begin
  insert into auth.users (id, email) values (v_dono, 'dono@exemplo.test'), (v_zé, null);

  perform set_config('autohunt.uid', v_dono::text, false);
  perform public.iniciar_sessao();
  perform set_config('autohunt.uid', v_zé::text, false);
  perform public.iniciar_sessao();

  -- Ninguém nasce admin.
  perform public.checar(not public.e_admin(), 'jogador comum não é admin');
  perform set_config('autohunt.uid', v_dono::text, false);
  perform public.checar(not public.e_admin(), 'nem o futuro dono nasce admin');

  -- Só o update manual promove — é o único caminho que existe.
  update public.jogador set admin = true where id = v_dono;
  perform public.checar(public.e_admin(), 'o update manual promove a admin');

  -- ---- prova 1: não-admin não escreve nada -------------------------------
  perform set_config('autohunt.uid', v_zé::text, false);
  v_valor := (select valor from public.ajuste where chave = 'xp_por_abate_base');
  v_r := public.definir_ajuste('xp_por_abate_base', 500);

  perform public.checar((v_r ->> 'aplicado')::boolean is false,
                        'não-admin é recusado por definir_ajuste');
  perform public.checar(v_r ->> 'motivo' = 'NAO_AUTORIZADO', 'a recusa diz o motivo');
  perform public.checar(
    (select valor from public.ajuste where chave = 'xp_por_abate_base') = v_valor,
    'a tentativa do não-admin não mudou o valor');

  -- A recusa SOBREVIVE: é por isso que ela devolve em vez de levantar exceção.
  select count(*) into v_eventos from public.evento_jogo
   where player_id = v_zé and tipo = 'ajuste.recusado';
  perform public.checar(v_eventos = 1, 'a recusa do não-admin ficou no log');

  -- ---- faixa ----------------------------------------------------------------
  perform set_config('autohunt.uid', v_dono::text, false);
  v_r := public.definir_ajuste('xp_por_abate_base', 999999);
  perform public.checar((v_r ->> 'aplicado')::boolean is false, 'acima do máximo é recusado');
  perform public.checar(v_r ->> 'motivo' = 'FORA_DA_FAIXA', 'a recusa de faixa diz o motivo');

  v_r := public.definir_ajuste('abates_base', 0);
  perform public.checar((v_r ->> 'aplicado')::boolean is false, 'abaixo do mínimo é recusado');

  v_r := public.definir_ajuste('nao_existe', 1);
  perform public.checar(v_r ->> 'motivo' = 'AJUSTE_INEXISTENTE', 'chave inexistente é recusada');

  -- O limite é inclusivo (edge case da spec).
  v_r := public.definir_ajuste('abates_base',
                               (select minimo from public.ajuste where chave = 'abates_base'));
  perform public.checar((v_r ->> 'aplicado')::boolean, 'o valor no limite da faixa é aceito');

  -- ---- o log diz quem, quando, de quanto para quanto -----------------------
  v_r := public.definir_ajuste('abates_base', 3);
  perform public.checar((v_r ->> 'aplicado')::boolean, 'o admin escreve');
  perform public.checar(
    exists (select 1 from public.evento_jogo
             where player_id = v_dono and tipo = 'ajuste.aplicado'
               and dados ->> 'chave' = 'abates_base'
               and dados ? 'de' and dados ? 'para'),
    'o ajuste aplicado registra de-para e autor');
  perform public.checar(
    (select atualizado_por from public.ajuste where chave = 'abates_base') = v_dono,
    'a linha guarda quem mexeu');

  -- ---- prova 2: o ajuste chega ao crédito, e só por dentro ------------------
  select o_xp into v_xp_a from public.resolver_ciclos(1::bigint, 100000, 4, 1, 0, 0);
  perform public.definir_ajuste('xp_multiplicador_global', 2);
  select o_xp into v_xp_b from public.resolver_ciclos(1::bigint, 100000, 4, 1, 0, 0);
  perform public.checar(v_xp_b = v_xp_a * 2, 'o boost de XP do console chega no crédito');
  perform public.definir_ajuste('xp_multiplicador_global', 1);
  select o_xp into v_xp_b from public.resolver_ciclos(1::bigint, 100000, 4, 1, 0, 0);
  perform public.checar(v_xp_b = v_xp_a, 'voltar o boost para 1 restaura o comportamento anterior');

  -- Nenhum número econômico viaja para o client.
  perform public.checar(
    not (public.montar_ajustes_visuais() ? 'xp_multiplicador_global'),
    'o snapshot não publica o multiplicador de XP');
  perform public.checar(
    not (public.montar_ajustes_visuais() ? 'xp_por_abate_base'),
    'o snapshot não publica XP por abate');
  perform public.checar(
    public.montar_ajustes_visuais() ? 'heroi_velocidade',
    'o snapshot publica a velocidade do herói');
  perform public.checar(
    not exists (select 1 from public.ajuste
                 where escopo = 'visual' and categoria = 'economia'),
    'nenhum número de economia está marcado como visual');

  -- E o caminho de verdade: o snapshot que o client recebe carrega o bloco, e
  -- carrega só o visual. É por ele que a velocidade do herói chega na tela.
  v_r := public.montar_snapshot(v_dono);
  perform public.checar(v_r ? 'ajustes', 'o snapshot publica o bloco de ajustes');
  perform public.checar((v_r -> 'ajustes') ? 'heroi_velocidade',
                        'o snapshot leva a velocidade do herói');
  perform public.checar(not ((v_r -> 'ajustes') ? 'abates_base'),
                        'o snapshot não leva abates por ciclo');
  perform public.checar((v_r #>> '{jogador,admin}')::boolean,
                        'o snapshot diz que o dono é admin');
end $$;

\echo '== permissões do console =='
do $$
begin
  -- A prova que sustenta "a tela pode estar no bundle": o client não escreve na
  -- tabela por caminho nenhum. Nem o admin — ele é `authenticated` como todo
  -- mundo, e passa pela RPC.
  perform public.checar(
    not has_table_privilege('authenticated', 'public.ajuste', 'UPDATE'),
    'authenticated não escreve em ajuste');
  perform public.checar(
    not has_table_privilege('authenticated', 'public.ajuste', 'INSERT'),
    'authenticated não insere em ajuste');
  perform public.checar(
    not has_table_privilege('authenticated', 'public.ajuste', 'DELETE'),
    'authenticated não apaga ajuste');
  perform public.checar(
    not has_table_privilege('anon', 'public.ajuste', 'SELECT'),
    'anônimo não lê ajuste');

  -- Ninguém se promove: é a mesma proteção de `nivel` e `moeda`.
  perform public.checar(
    not has_column_privilege('authenticated', 'public.jogador', 'admin', 'UPDATE'),
    'authenticated não escreve jogador.admin');

  -- A leitura dos econômicos é do admin; a política é quem separa.
  perform public.checar(
    exists (select 1 from pg_policies
             where schemaname = 'public' and tablename = 'ajuste'
               and qual like '%escopo%' and qual like '%e_admin%'),
    'a política de leitura separa visual de econômico');

  -- As funções internas do console continuam inalcançáveis.
  perform public.checar(
    not has_function_privilege('authenticated', 'public.ajuste_num(text, numeric)', 'execute'),
    'authenticated NÃO alcança ajuste_num');
  perform public.checar(
    not has_function_privilege('authenticated', 'public.montar_ajustes_visuais()', 'execute'),
    'authenticated NÃO alcança montar_ajustes_visuais');
end $$;

\echo ''
\echo '========================================'
\echo '  TODAS AS VERIFICAÇÕES PASSARAM'
\echo '========================================'
