-- ============================================================================
-- Autohunt Idle — o console de ajuste do jogo.
--
-- Implementa `specs/console-de-ajuste.md`. O pedido do dono: *"um console pra eu
-- editar todos os tipos de coisa no jogo — velocidade, boost de XP, spawn de
-- monstros, dano de monstros"*.
--
-- POR QUE ISTO EXISTE: quase todo número do jogo hoje é chute meu (D4 do
-- backlog). Ciclo de 15 s, 3 abates por ciclo, herói a 110 de velocidade,
-- alcance de tiro em 210 — escolhidos para o sistema ficar observável, não para
-- ser divertido. Só quem joga sabe qual é qual, e até agora mudar qualquer um
-- exigia uma migration.
--
-- A DECISÃO QUE MOLDA TUDO: **a proteção mora no banco, nunca na tela.**
-- Esconder a rota de admin é obscuridade, e obscuridade não é controle. A tela
-- vai no bundle que todo jogador baixa. O que protege é que `ajuste` não tem
-- grant de UPDATE para ninguém do lado do client — nem para o admin — e que a
-- única escrita passa por uma RPC `SECURITY DEFINER` que confere quem é.
--
-- O QUE ESTA MIGRATION NÃO AFROUXA: nenhuma RPC passou a receber número de
-- balanceamento do client. Os valores econômicos são lidos DENTRO do servidor,
-- por `resolver_ciclos`; os visuais viajam no snapshot, de saída, e não
-- creditam nada. O client continua sem declarar ganho.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Quem é admin
--
-- Não existe autocadastro, convite nem botão. Vira admin quem receber um
-- `update` no SQL editor do Supabase:
--
--   update public.jogador set admin = true where id = '<uuid do dono>';
--
-- É deliberado. Qualquer fluxo DENTRO do jogo que conceda admin é um fluxo que
-- pode ser explorado; o `update` manual exige a chave do projeto, que já é o
-- nível de acesso mais alto que existe.
--
-- A coluna nasce fora do grant de UPDATE do client sem precisar de nada: o
-- grant de `jogador` é por coluna (`data_nascimento, idioma`), então coluna
-- nova não entra por omissão. É a mesma proteção que segura `nivel` e `moeda`.
-- ---------------------------------------------------------------------------
alter table public.jogador
  add column if not exists admin boolean not null default false;

comment on column public.jogador.admin is
  'Acesso ao console de ajuste. Concedido só por update manual no SQL editor — não existe caminho dentro do jogo.';

-- ---------------------------------------------------------------------------
-- 2. A tabela de ajuste
--
-- `minimo` e `maximo` NÃO são enfeite de formulário: são a diferença entre um
-- zero digitado errado em "abates por ciclo" e o jogo inteiro parar, e entre um
-- 999999 em "XP por abate" e a economia virar pó num clique. A faixa é
-- constraint de tabela, então vale mesmo que alguém escreva por fora da RPC.
--
-- `escopo` separa as duas naturezas que o resto do projeto manteve apartadas
-- com muito cuidado:
--   visual    → lido pelo CLIENT, via snapshot. Muda a sensação de jogar.
--   economico → lido só pelo SERVIDOR. Muda quanto todo mundo ganha.
-- ---------------------------------------------------------------------------
create table if not exists public.ajuste (
  chave          text primary key,
  valor          numeric not null,
  minimo         numeric not null,
  maximo         numeric not null,
  escopo         text not null check (escopo in ('visual', 'economico')),
  categoria      text not null check (categoria in ('heroi', 'inimigo', 'mundo', 'economia')),
  descricao      text not null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references public.jogador(id) on delete set null,

  constraint ajuste_faixa_coerente check (minimo <= maximo),
  constraint ajuste_valor_na_faixa check (valor between minimo and maximo)
);

comment on table public.ajuste is
  'Números de balanceamento editáveis pelo dono. Sem UPDATE para o client — a escrita passa só por definir_ajuste.';
comment on column public.ajuste.escopo is
  'visual = o client lê e desenha; economico = só o servidor lê, e é o que credita.';

alter table public.ajuste enable row level security;

-- ---------------------------------------------------------------------------
-- 3. e_admin — a pergunta que a tela e a política fazem
--
-- Sem parâmetro, como toda RPC que o client alcança: ela responde sobre
-- `auth.uid()`, e não sobre um uuid que alguém digitou. Um jogador saber que
-- NÃO é admin é justamente o que a tela precisa para recusar com o motivo
-- escrito, em vez de sumir.
-- ---------------------------------------------------------------------------
create or replace function public.e_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select j.admin from public.jogador j where j.id = auth.uid()), false);
$$;

revoke execute on function public.e_admin() from public, anon;
grant execute on function public.e_admin() to authenticated;

-- Leitura: todo jogador enxerga os visuais (o client precisa deles para
-- desenhar), e só o admin enxerga os econômicos. Não é segredo criptográfico —
-- é manter a superfície do jogador exatamente do tamanho do que ele usa.
drop policy if exists ajuste_leitura on public.ajuste;
create policy ajuste_leitura on public.ajuste
  for select to authenticated
  using (escopo = 'visual' or public.e_admin());

-- SELECT com colunas explícitas, e **nenhum** insert/update/delete.
-- Nem o admin escreve direto: ele passa por `definir_ajuste`, que valida faixa
-- e registra quem mudou o quê.
grant select (chave, valor, minimo, maximo, escopo, categoria, descricao, atualizado_em)
  on public.ajuste to authenticated;

-- ---------------------------------------------------------------------------
-- 4. ajuste_num — como o servidor lê um número
--
-- O padrão embutido não é preguiça: é o edge case de "a linha sumiu". Jogo que
-- para porque alguém apagou uma linha de balanceamento é pior que jogo mal
-- balanceado.
-- ---------------------------------------------------------------------------
create or replace function public.ajuste_num(p_chave text, p_padrao numeric)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select a.valor from public.ajuste a where a.chave = p_chave), p_padrao);
$$;

revoke execute on function public.ajuste_num(text, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. O catálogo inicial — os chutes de hoje, com faixa
--
-- Os valores partem exatamente do que o código já usa, para ligar o console não
-- mudar nada. As faixas são o que consigo defender: larga o bastante para o
-- dono achar o ponto certo, estreita o bastante para não existir clique que
-- quebre o jogo.
-- ---------------------------------------------------------------------------
insert into public.ajuste (chave, valor, minimo, maximo, escopo, categoria, descricao) values
  -- Visuais: o client lê e desenha. Adulterar um destes no navegador só muda a
  -- tela de quem adulterou, porque nada disto credita.
  ('heroi_velocidade',        110, 20,  400, 'visual', 'heroi',
   'Quanto o herói anda por segundo. Toque mais alto = jogo mais nervoso.'),
  ('heroi_alcance_tiro',      210, 60,  600, 'visual', 'heroi',
   'A que distância o herói mira e dispara.'),
  ('heroi_recarga_tiro',     0.45, 0.1,   3, 'visual', 'heroi',
   'Segundos entre um tiro e o próximo.'),
  ('heroi_dano_projetil',      12, 1,   200, 'visual', 'heroi',
   'Dano de cada tiro NA TELA. Não altera recompensa — inimigo derrubado não credita nada.'),
  ('projetil_velocidade',     320, 60, 1200, 'visual', 'heroi',
   'Velocidade do tiro. Baixo demais e o inimigo foge do projétil.'),
  ('inimigos_na_tela',          8, 1,   40,  'visual', 'mundo',
   'Quantos inimigos ficam vivos por perto. As regiões mais intensas somam até 4 a mais.'),
  ('inimigo_vida',              1, 0.2,  5,  'visual', 'inimigo',
   'Multiplica a vida de todas as espécies. Alto demais e o herói não derruba ninguém.'),
  ('inimigo_velocidade',        1, 0.1,  4,  'visual', 'inimigo',
   'Multiplica a velocidade de todas as espécies.'),
  ('inimigo_tamanho',           1, 0.4,  3,  'visual', 'inimigo',
   'Multiplica o tamanho das espécies. Mexe em colisão e em leitura da tela.'),

  -- Econômicos: lidos SÓ dentro de `resolver_ciclos`. Nunca saem para o client,
  -- e nenhuma RPC passou a recebê-los de fora.
  ('xp_multiplicador_global',   1, 0.1,  10, 'economico', 'economia',
   'Boost de XP para todo mundo. É o botão de evento — 2 é fim de semana de XP dobrado.'),
  ('moeda_multiplicador_global', 1, 0.1, 10, 'economico', 'economia',
   'Mesma ideia, para o ouro.'),
  ('abates_base',               3, 1,    30, 'economico', 'economia',
   'Abates por ciclo no nível 1. É o botão de ritmo: dobrar aqui dobra XP e ouro juntos.'),
  ('xp_por_abate_base',         4, 1,   500, 'economico', 'economia',
   'XP de um abate no nível 1. O nível do jogador soma a isto.'),
  ('moeda_por_abate_base',      2, 0,   500, 'economico', 'economia',
   'Ouro de um abate no nível 1. Metade do nível soma a isto.'),
  ('dano_por_ciclo_base',       8, 0,   500, 'economico', 'economia',
   'Dano que o jogador leva por ciclo no nível 1. Quando a vitalidade zera, o ciclo é perdido.'),
  ('ataque_por_abate',          8, 1,   200, 'economico', 'economia',
   'Quanto poder de ataque vale um abate extra por ciclo. Menor = equipamento pesa mais.')
on conflict (chave) do nothing;

-- ---------------------------------------------------------------------------
-- 6. definir_ajuste — a única porta de escrita
--
-- Recusa em vez de levantar exceção quando quem chamou não é admin, e é
-- deliberado: `raise` derrubaria a transação inteira, **e junto o registro da
-- tentativa**. A recusa precisa sobreviver para virar log (critério 2 da spec).
-- ---------------------------------------------------------------------------
create or replace function public.definir_ajuste(p_chave text, p_valor numeric)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_linha public.ajuste%rowtype;
  v_antes numeric;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  -- A pergunta que protege o jogo inteiro. Um jogador comum chega aqui — a
  -- tela está no bundle dele — e sai sem mudar nada, deixando rastro.
  if not public.e_admin() then
    insert into public.evento_jogo (player_id, tipo, dados)
    values (v_uid, 'ajuste.recusado',
            jsonb_build_object('chave', p_chave, 'motivo', 'NAO_AUTORIZADO'));
    return jsonb_build_object('aplicado', false, 'motivo', 'NAO_AUTORIZADO');
  end if;

  if p_valor is null then
    return jsonb_build_object('aplicado', false, 'motivo', 'VALOR_AUSENTE');
  end if;

  select * into v_linha from public.ajuste where chave = p_chave for update;
  if v_linha.chave is null then
    return jsonb_build_object('aplicado', false, 'motivo', 'AJUSTE_INEXISTENTE');
  end if;

  -- A faixa é inclusiva, e é da própria linha: cada número tem o limite que faz
  -- sentido para ele, não um limite genérico.
  if p_valor < v_linha.minimo or p_valor > v_linha.maximo then
    insert into public.evento_jogo (player_id, tipo, dados)
    values (v_uid, 'ajuste.recusado',
            jsonb_build_object('chave', p_chave, 'motivo', 'FORA_DA_FAIXA',
                               'valor', p_valor,
                               'minimo', v_linha.minimo, 'maximo', v_linha.maximo));
    return jsonb_build_object(
      'aplicado', false, 'motivo', 'FORA_DA_FAIXA',
      'minimo', v_linha.minimo, 'maximo', v_linha.maximo
    );
  end if;

  v_antes := v_linha.valor;

  update public.ajuste
     set valor = p_valor, atualizado_em = now(), atualizado_por = v_uid
   where chave = p_chave;

  -- Quem, quando, de quanto para quanto (critério 5). Sem isto o console vira
  -- uma economia que muda sozinha.
  insert into public.evento_jogo (player_id, tipo, dados)
  values (v_uid, 'ajuste.aplicado',
          jsonb_build_object('chave', p_chave, 'de', v_antes, 'para', p_valor,
                             'escopo', v_linha.escopo));

  return jsonb_build_object('aplicado', true, 'chave', p_chave, 'de', v_antes, 'para', p_valor);
end;
$$;

revoke execute on function public.definir_ajuste(text, numeric) from public, anon;
grant execute on function public.definir_ajuste(text, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. montar_ajustes_visuais — o que viaja para o client
--
-- Só o escopo visual, e de saída. Nenhum econômico entra aqui: XP por abate,
-- dano por ciclo e os multiplicadores globais não têm por que existir no
-- navegador de ninguém.
-- ---------------------------------------------------------------------------
create or replace function public.montar_ajustes_visuais()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_object_agg(a.chave, a.valor), '{}'::jsonb)
    from public.ajuste a
   where a.escopo = 'visual';
$$;

revoke execute on function public.montar_ajustes_visuais() from public, anon, authenticated;

-- ============================================================================
-- 8. resolver_ciclos — as constantes viram leitura de tabela
--
-- É a função que decide TODA recompensa do jogo: quantos abates cabem num
-- ciclo, quanto vale cada um, quanto dano o jogador leva. Concentrar os números
-- econômicos aqui é o que torna o console pequeno: um lugar só passa a ler da
-- tabela, e o jogo inteiro obedece.
--
-- Deixou de ser `immutable` e virou `stable`: ela agora consulta uma tabela.
-- Continua sem efeito colateral e sem receber nada do client — quem a chama é
-- `creditar_ciclos`, do lado do servidor.
--
-- MUDANÇA MID-SESSÃO: vale do próximo lote em diante. Nada é recalculado para
-- trás, porque o crédito já aconteceu — e recalcular mexeria no saldo de quem
-- já jogou.
-- ============================================================================
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
stable
as $$
declare
  -- Os padrões repetem os valores originais: se a tabela sumir inteira, o jogo
  -- roda exatamente como rodava antes do console existir.
  v_abates_base      integer := public.ajuste_num('abates_base', 3)::integer;
  v_xp_base_abate    integer := public.ajuste_num('xp_por_abate_base', 4)::integer;
  v_moeda_base_abate integer := public.ajuste_num('moeda_por_abate_base', 2)::integer;
  v_dano_base_ciclo  integer := public.ajuste_num('dano_por_ciclo_base', 8)::integer;
  v_ataque_por_abate integer := greatest(1, public.ajuste_num('ataque_por_abate', 8)::integer);
  v_mult_xp_global    numeric := public.ajuste_num('xp_multiplicador_global', 1);
  v_mult_moeda_global numeric := public.ajuste_num('moeda_multiplicador_global', 1);

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
  -- Piso de 1 abate: a faixa já impede zero, mas um catálogo editado por fora
  -- não pode ser o que faz o jogo parar de render.
  v_abates_por_ciclo := greatest(1, v_abates_base + (p_nivel / 10)::integer
                                    + (coalesce(p_poder_ataque, 0) / v_ataque_por_abate));
  v_xp_por_abate     := v_xp_base_abate + p_nivel;
  v_moeda_por_abate  := v_moeda_base_abate + (p_nivel / 2);
  v_dano_por_ciclo   := v_dano_base_ciclo + p_nivel::integer;

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
      -- O multiplicador global entra por último e é truncado: assim ele nunca
      -- inventa fração de XP, e 1 continua sendo exatamente o comportamento
      -- anterior ao console.
      o_xp    := o_xp
                 + floor(v_abates_por_ciclo * v_xp_por_abate * p_multiplicador_xp
                         * v_mult_xp_global)::bigint;
      o_moeda := o_moeda
                 + floor(v_abates_por_ciclo * v_moeda_por_abate * v_mult_moeda_global)::bigint;
    end if;
  end loop;
end;
$$;

revoke execute on function
  public.resolver_ciclos(bigint, integer, integer, integer, integer, integer)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. montar_snapshot — passa a publicar os ajustes visuais
--
-- Repetida por inteiro, como em toda rodada: o Postgres não estende função, e
-- um wrapper esconderia de quem lê onde o payload é montado.
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
      'identidadeVerificada', public.identidade_verificada(p_uid),
      -- O client usa isto só para decidir se abre o console. Quem mentir aqui
      -- vê a tela e não consegue escrever nada — a RPC confere de novo.
      'admin',              coalesce(v_jog.admin, false)
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
    -- Só o escopo visual. Nenhum número que credita sai daqui.
    'ajustes', public.montar_ajustes_visuais(),
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
      -- O 2× do assinante NÃO virou ajuste, de propósito: é o que a pessoa
      -- comprou. Um número que muda o que já foi vendido não é balanceamento.
      -- Quem quiser mexer no ritmo mexe em `xp_multiplicador_global`.
      'multiplicadorXp', case when v_assinante then 2 else 1 end,
      'tetoOfflineMinutos', case when v_assinante then 1440
                                 else v_fs.minutos_anuncio_saldo end
    )
  );
end;
$$;
