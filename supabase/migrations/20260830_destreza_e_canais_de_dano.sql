-- ============================================================================
-- Autohunt Idle — a arma decide qual atributo importa, e nasce a Destreza.
--
-- Pedido do dono (2026-08-14): "se ele usa cajado tem que dar dano mágico,
-- logo se ele upar força não pode aumentar o dano". O schema fazia o contrário
-- em silêncio: `poder_de_ataque` somava o atributo que NÃO casa com a arma pela
-- metade (`v_secundario / 2`). Com cajado na mão, subir Força aumentava o dano
-- de verdade — metade do valor, mas aumentava. A tela dizia "Dano mágico" e o
-- servidor pagava por Força assim mesmo, e nenhuma das duas coisas estava
-- errada isoladamente: erradas eram as duas juntas.
--
-- POR QUE UM CANAL NOVO, E NÃO SÓ O CONSERTO DA METADE
--
-- Com dois canais, "arma física" abrigava espada, martelo, arco e adaga sob o
-- mesmo atributo. Arqueiro não era uma build: era um ícone diferente de
-- guerreiro. Três canais dão ao arco e à adaga o mesmo que o cajado sempre teve
-- — um atributo próprio, um par de conjuntos temáticos e um degrau de sinergia:
--
--   fisico   → Força        → espada, martelo
--   destreza → Destreza     → arco, adaga
--   magico   → Inteligência → cajado, varinha
--
-- POR QUE O `canal_historico_da_arma` EXISTE, E É O CORAÇÃO DESTA MIGRATION
--
-- A família visual da arma (`src/game/armas.ts`) nunca foi gravada: ela é
-- derivada de um hash do id do item. Enquanto "físico" tinha quatro famílias, a
-- conta era `hash % 4`; com a divisão em dois canais, vira `hash % 2` dentro de
-- cada canal. Se esta migration só trocasse a coluna, metade dos jogadores
-- acordaria com outra arma na mão sem que uma linha de teste piscasse.
--
-- O helper reproduz `embaralhar(id) % 4` dentro do Postgres para decidir, item
-- por item, qual canal preserva a arma que o jogador já vê. Ele NÃO porta o
-- FNV-1a de 32 bits: só os dois bits baixos importam, e eles sobrevivem ao XOR
-- e à multiplicação (2166136261 mod 4 = 1, 16777619 mod 4 = 3). A recorrência
-- de duas linhas lá embaixo devolve exatamente o mesmo resto — conferido contra
-- a função de TypeScript em 250 mil ids, com zero divergências.
--
-- POR QUE ESTA MIGRATION ZERA A ALOCAÇÃO DE TODO MUNDO (de novo)
--
-- Mesmo motivo de `20260829_atributos_manuais.sql`, por outro caminho: quem
-- tem arco equipado hoje soma Força inteira e, a partir daqui, somaria zero.
-- Não é um ajuste de balanceamento, é a contribuição INTEIRA do atributo
-- sumindo entre uma abertura do jogo e a seguinte, sem aviso. Zerar não tira
-- nada de ninguém — o respec é livre e sem penalidade, então os pontos voltam
-- inteiros para o jogador gastar do jeito dele, agora sabendo a regra.
--
-- Espelhado em `src/game/regrasEquipamento.ts` e `src/game/regrasAtributos.ts`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. O quinto atributo
-- ---------------------------------------------------------------------------
alter table public.atributo_jogador
  add column if not exists destreza integer not null default 0 check (destreza >= 0);

comment on column public.atributo_jogador.destreza is
  'Atributo do canal de Destreza: soma inteiro quando a arma equipada é de arco ou adaga, e zero em qualquer outra.';

-- ---------------------------------------------------------------------------
-- 2. O canal que preserva a arma que o jogador já enxerga
--
-- `embaralhar(id) % 4` reproduzido pelos dois bits baixos. A recorrência começa
-- em 1 porque é o resto de 2166136261, e multiplica por 3 porque é o resto de
-- 16777619 — o resto do produto só depende do resto dos fatores, e o do XOR só
-- depende dos bits baixos. Por isso 32 bits inteiros seriam trabalho jogado
-- fora: o resultado seria idêntico.
--
-- Resto 1 (adaga) e 2 (arco) viram o canal novo; 0 (espada) e 3 (martelo)
-- ficam onde estavam. Trocar essa dupla por qualquer outra rebatiza a arma de
-- metade dos jogadores.
-- ---------------------------------------------------------------------------
create or replace function public.canal_historico_da_arma(p_id text)
returns text
language plpgsql
immutable
as $$
declare
  v_h integer := 1;
  v_i integer;
begin
  if p_id is null then
    return 'fisico';
  end if;

  for v_i in 1 .. length(p_id) loop
    v_h := ((v_h # (ascii(substr(p_id, v_i, 1)) & 3)) * 3) % 4;
  end loop;

  return case when v_h in (1, 2) then 'destreza' else 'fisico' end;
end;
$$;

comment on function public.canal_historico_da_arma(text) is
  'Canal que preserva a família visual histórica da arma (adaga e arco viram Destreza). Só a migration de reclassificação a usa.';

-- Sem isto ela nasce alcançável pelo client em qualquer projeto que ainda
-- carregue as default privileges do Supabase — e a lista fechada de RPCs do
-- jogador (`scripts/teste-migrations.sql`) reprova na hora.
revoke execute on function public.canal_historico_da_arma(text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. As duas checagens de canal aceitam o terceiro valor
--
-- Elas nasceram inline em `20260817_equipamento_e_conjunto.sql`, então o nome
-- é gerado pelo Postgres. Derrubar pelo CATÁLOGO em vez de pelo nome tira desta
-- migration a dependência de um detalhe que ninguém escolheu — e a torna
-- idempotente, porque o laço também alcança os nomes explícitos recriados
-- logo abaixo.
--
-- A ordem importa: o UPDATE do passo 4 escreve 'destreza', que a checagem
-- antiga recusa. Com ela no lugar, o passo seguinte falharia inteiro.
-- ---------------------------------------------------------------------------
do $$
declare
  v_nome text;
begin
  for v_nome in
    select c.conname
      from pg_constraint c
     where c.conrelid = 'public.item_jogador'::regclass
       and c.contype = 'c'
       and (pg_get_constraintdef(c.oid) like '%tipo\_dano%'
            or pg_get_constraintdef(c.oid) like '%afinidade%')
  loop
    execute format('alter table public.item_jogador drop constraint %I', v_nome);
  end loop;
end $$;

alter table public.item_jogador
  add constraint item_jogador_tipo_dano_check
  check (tipo_dano in ('fisico', 'destreza', 'magico'));

alter table public.item_jogador
  add constraint item_jogador_afinidade_check
  check (afinidade in ('fisico', 'destreza', 'magico'));

-- ---------------------------------------------------------------------------
-- 4. Reclassificação do acervo — o passo que pode estragar dado em silêncio
--
-- `coalesce(tipo_dano, 'fisico')` NÃO é zelo: `sintetizar` insere arma sem
-- tipo de dano nenhum (`20260818_slots_por_parte_do_corpo.sql`), então existe
-- uma população inteira com a coluna NULA — e `tipo_dano = 'fisico'` não casa
-- com NULL. Sem o coalesce, toda arma sintetizada que hoje é adaga virava
-- martelo e todo arco virava espada, que é exatamente o estrago que este passo
-- existe para evitar.
--
-- Arma de conjunto fica DE FORA: o tipo de dano dela é ditado pelo tema
-- (`tipo_dano_do_conjunto`). Reclassificá-la descasaria a arma das peças do
-- próprio conjunto e mataria o bônus de todas de uma vez. Ela pode mudar de
-- família — uma adaga de 'cavaleiro-biscoito' vira espada ou martelo —, e isso
-- é mais temático, não menos.
--
-- Arma mágica não é tocada: cajado e varinha continuam sendo as duas únicas
-- famílias do canal, então o resto do hash já as separa igual.
-- ---------------------------------------------------------------------------
update public.item_jogador
   set tipo_dano = 'destreza'
 where tipo = 'arma'
   and conjunto_id is null
   and coalesce(tipo_dano, 'fisico') = 'fisico'
   and public.canal_historico_da_arma(id::text) = 'destreza';

-- ---------------------------------------------------------------------------
-- 5. poder_de_ataque — um canal, um atributo, e mais nada
--
-- O `+ (v_secundario / 2)` some. Era ele que fazia Força pagar dano de cajado,
-- e é a sua ausência que responde ao pedido do dono: com a arma errada, o
-- atributo contribui ZERO. Não é penalidade — é o que torna a escolha de arma
-- uma escolha.
--
-- Três coisas continuam exatamente como estavam, e nenhuma é decorativa:
-- o `coalesce(v_arma.tipo_dano, 'fisico')` (arma sintetizada tem a coluna
-- nula), o filtro `slot <> 'arma'` sobre `slots_de_poder()` — é ele, e só ele,
-- que faz "skin nunca tem stat" ser estrutural no servidor — e os três degraus
-- de conjunto.
-- ---------------------------------------------------------------------------
create or replace function public.poder_de_ataque(p_player_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  c_sinergia   constant numeric := 0.20;
  c_conjunto_2 constant numeric := 0.08;
  c_conjunto_4 constant numeric := 0.20;
  c_conjunto_6 constant numeric := 0.45;

  v_attr       public.atributo_jogador%rowtype;
  v_arma       public.item_jogador%rowtype;
  v_tipo_dano  text;
  v_poder_arma numeric := 0;
  v_poder_peca numeric := 0;
  v_principal  integer;
  v_pecas      integer;
  v_mult       numeric := 1;
  v_peca       public.item_jogador%rowtype;
begin
  select * into v_attr from public.atributo_jogador where player_id = p_player_id;

  select * into v_arma
    from public.item_jogador
   where player_id = p_player_id and slot = 'arma';

  v_tipo_dano := coalesce(v_arma.tipo_dano, 'fisico');

  if v_arma.id is not null then
    v_poder_arma := public.poder_do_item(v_arma.raridade, v_arma.fortificacao);
  end if;

  for v_peca in
    select * from public.item_jogador
     where player_id = p_player_id
       and slot = any (public.slots_de_poder())
       and slot <> 'arma'
  loop
    if v_peca.afinidade is not null and v_peca.afinidade = v_tipo_dano then
      v_poder_peca := v_poder_peca
                      + public.poder_do_item(v_peca.raridade, v_peca.fortificacao)
                        * (1 + c_sinergia);
    else
      v_poder_peca := v_poder_peca + public.poder_do_item(v_peca.raridade, v_peca.fortificacao);
    end if;
  end loop;

  -- Um atributo por canal. O que não casa com a arma equipada não entra na
  -- soma de forma nenhuma — nem pela metade.
  case v_tipo_dano
    when 'destreza' then v_principal := coalesce(v_attr.destreza, 0);
    when 'magico'   then v_principal := coalesce(v_attr.inteligencia, 0);
    else                 v_principal := coalesce(v_attr.forca, 0);
  end case;

  select coalesce(max(quantidade), 0) into v_pecas
    from (
      select count(*) as quantidade
        from public.item_jogador
       where player_id = p_player_id
         and slot = any (public.slots_de_poder())
         and conjunto_id is not null
       group by conjunto_id
    ) as agrupado;

  if v_pecas >= 6 then
    v_mult := 1 + c_conjunto_6;
  elsif v_pecas >= 4 then
    v_mult := 1 + c_conjunto_4;
  elsif v_pecas >= 2 then
    v_mult := 1 + c_conjunto_2;
  end if;

  return floor((v_poder_arma + v_poder_peca + v_principal) * v_mult)::integer;
end;
$$;

revoke execute on function public.poder_de_ataque(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. conceder_item — o sorteio de canal vira de três vias
--
-- As sementes (':dano', ':afin', ':afin2', ':conj', ':qual') ficam LETRA POR
-- LETRA como estavam. Mudar uma delas re-sorteia todo o futuro de um jeito
-- diferente do que o teste de determinismo espera, e trocaria uma correção de
-- regra por uma mudança silenciosa de loot.
--
-- A fatia de acessório COM afinidade continua 0,6: o que muda é qual das três
-- afinidades sai, não quantos acessórios têm uma.
-- ---------------------------------------------------------------------------
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
  v_tipo      text := p_tipo;
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

  if v_tipo = 'equipamento' then
    v_tipo := public.sortear_tipo_equipamento(v_semente || ':parte');
  end if;

  -- Chave e pedra são consumíveis, não loot: nascem comuns, sem sorteio.
  if v_tipo = 'chave' or v_tipo like 'pedra\_%' then
    v_raridade := 1;
  else
    v_raridade := public.escalar_raridade(v_semente, p_piso, p_teto, p_sorte);
  end if;

  if v_tipo = any (public.slots_de_poder()) and v_raridade >= 4 then
    if public.sorteio01(v_semente || ':conj') < 0.5 then
      v_lista := public.conjuntos_disponiveis();
      v_conjunto := v_lista[1 + floor(public.sorteio01(v_semente || ':qual')
                                      * array_length(v_lista, 1))::integer];
    end if;
  end if;

  if v_tipo = 'arma' then
    v_tipo_dano := coalesce(
      public.tipo_dano_do_conjunto(v_conjunto),
      case
        when public.sorteio01(v_semente || ':dano') < 1.0 / 3 then 'fisico'
        when public.sorteio01(v_semente || ':dano') < 2.0 / 3 then 'destreza'
        else 'magico'
      end
    );
  elsif v_tipo = any (public.slots_de_poder()) then
    -- Nem toda peça tem afinidade; sem ela, contribui o stat normal.
    if v_conjunto is not null then
      v_afinidade := public.tipo_dano_do_conjunto(v_conjunto);
    elsif public.sorteio01(v_semente || ':afin') < 0.6 then
      v_afinidade := case
        when public.sorteio01(v_semente || ':afin2') < 1.0 / 3 then 'fisico'
        when public.sorteio01(v_semente || ':afin2') < 2.0 / 3 then 'destreza'
        else 'magico'
      end;
    end if;
  end if;

  insert into public.item_jogador (player_id, tipo, raridade, origem,
                                   tipo_dano, afinidade, conjunto_id)
  values (p_player_id, v_tipo, v_raridade, p_origem, v_tipo_dano, v_afinidade, v_conjunto)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.conceder_item(uuid, text, smallint, smallint, text, integer)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Dois conjuntos de Destreza
--
-- Sem eles, o degrau de 6 peças fica fora do alcance de quem joga de arco: o
-- sorteio de conjunto só entrega temas físicos e mágicos, e um arqueiro
-- montando 6 peças de 'bruxa-caramelo' estaria juntando afinidade que a arma
-- dele não casa. Conjunto aqui é puramente nominal — nome, canal e chave de
-- i18n, zero arte —, então dois novos custam o que se lê abaixo.
--
-- Entram no FIM do array de propósito: as posições 1 a 4 são as que os itens já
-- concedidos referenciam pelo nome, e mexer na ordem não os alcança, mas
-- confundiria quem for ler o histórico.
-- ---------------------------------------------------------------------------
create or replace function public.conjuntos_disponiveis()
returns text[]
language sql
immutable
as $$
  select array['bruxa-caramelo', 'cavaleiro-biscoito', 'feiticeira-menta',
               'brutamontes-nougat', 'arqueira-avela', 'ladina-amora'];
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
    when 'arqueira-avela'     then 'destreza'
    when 'ladina-amora'       then 'destreza'
    else null
  end;
$$;

-- ---------------------------------------------------------------------------
-- 8. redistribuir_atributos — cinco atributos, e a de quatro DEIXA DE EXISTIR
--
-- O `drop` não é limpeza: `create or replace` com aridade diferente cria
-- SOBRECARGA, e a versão de quatro continuaria concedida a `authenticated`
-- (`20260813` e `20260823`). O exploit sai de graça: aloca Destreza pela RPC
-- nova, chama a de quatro argumentos, que soma o custo de só quatro atributos,
-- aprova a conta e não zera Destreza no upsert. Pontos de graça, repetível
-- quantas vezes o jogador quiser.
-- ---------------------------------------------------------------------------
drop function if exists public.redistribuir_atributos(integer, integer, integer, integer);

create or replace function public.redistribuir_atributos(
  p_forca        integer,
  p_destreza     integer,
  p_inteligencia integer,
  p_vitalidade   integer,
  p_sorte        integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_nivel  bigint;
  v_custo  bigint;
  v_pontos bigint;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  if p_forca is null or p_destreza is null or p_inteligencia is null
     or p_vitalidade is null or p_sorte is null
     or p_forca < 0 or p_destreza < 0 or p_inteligencia < 0
     or p_vitalidade < 0 or p_sorte < 0 then
    raise exception 'ATRIBUTO_INVALIDO';
  end if;

  select nivel into v_nivel from public.jogador where id = v_uid;
  if v_nivel is null then
    raise exception 'SESSAO_NAO_INICIADA';
  end if;

  v_custo := public.custo_acumulado_atributo(p_forca)
             + public.custo_acumulado_atributo(p_destreza)
             + public.custo_acumulado_atributo(p_inteligencia)
             + public.custo_acumulado_atributo(p_vitalidade)
             + public.custo_acumulado_atributo(p_sorte);

  v_pontos := public.pontos_ganhos_ate(v_nivel);

  if v_custo > v_pontos then
    raise exception 'PONTOS_INSUFICIENTES';
  end if;

  -- `auto_alocar` continua sendo escrita como falsa por herança: a
  -- auto-alocação saiu do jogo em 20260829, mas a coluna segue publicada no
  -- snapshot e no export, e deixá-la verdadeira em alguma linha antiga
  -- mostraria ao client um estado que não existe mais.
  insert into public.atributo_jogador
    (player_id, forca, destreza, inteligencia, vitalidade, sorte, auto_alocar)
  values (v_uid, p_forca, p_destreza, p_inteligencia, p_vitalidade, p_sorte, false)
  on conflict (player_id) do update
    set forca         = excluded.forca,
        destreza      = excluded.destreza,
        inteligencia  = excluded.inteligencia,
        vitalidade    = excluded.vitalidade,
        sorte         = excluded.sorte,
        auto_alocar   = false,
        atualizado_em = now();

  insert into public.evento_jogo (player_id, tipo, dados)
  values (v_uid, 'atributo.redistribuido',
          jsonb_build_object('forca', p_forca, 'destreza', p_destreza,
                             'inteligencia', p_inteligencia,
                             'vitalidade', p_vitalidade, 'sorte', p_sorte));

  return public.montar_snapshot(v_uid);
end;
$$;

revoke execute on function
  public.redistribuir_atributos(integer, integer, integer, integer, integer)
  from public, anon, authenticated;

grant execute on function public.redistribuir_atributos(integer, integer, integer, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. montar_snapshot — publica a Destreza, e COBRA por ela
--
-- Repetida por inteiro, como em toda rodada: o Postgres não estende função, e
-- um wrapper esconderia de quem lê onde o payload é montado.
--
-- A subtração do custo da Destreza em `pontosLivres` é a metade que se esquece:
-- sem ela o painel ofereceria ponto que o servidor recusa, e o jogador
-- descobriria o limite batendo nele. "Prevenção de erro > mensagem de erro"
-- (`CLAUDE.md`, Princípio nº1) mora exatamente nesta linha.
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
                     - public.custo_acumulado_atributo(coalesce(v_attr.destreza, 0))
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
      'destreza',     coalesce(v_attr.destreza, 0),
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

-- ---------------------------------------------------------------------------
-- 10. exportar_meus_dados — a Destreza é dado do titular
--
-- Exportação que esquece uma coluna nova é exatamente a forma como o direito de
-- acesso vira promessa parcial (`docs/11_SEGURANCA/dados-pessoais-lgpd.md` §2).
-- É LGPD, não capricho.
-- ---------------------------------------------------------------------------
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
      select jsonb_build_object('forca', a.forca, 'destreza', a.destreza,
                                'inteligencia', a.inteligencia,
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
    'assinatura', (
      select jsonb_build_object('status', s.status, 'expiraEm', s.expira_em)
        from public.assinatura s where s.player_id = v_uid
    ),
    -- Sem `referencia_externa`, pelo mesmo motivo da assinatura: é dado do
    -- provedor, não do titular.
    'passe', (
      select jsonb_build_object('ativo', p.ativo, 'pontos', p.pontos,
                                'tier', p.tier, 'ativadoEm', p.ativado_em)
        from public.passe_jogador p where p.player_id = v_uid
    ),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', i.tipo, 'raridade', i.raridade,
                                          'fortificacao', i.fortificacao,
                                          'slot', i.slot, 'origem', i.origem,
                                          'obtidoEm', i.obtido_em)
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

revoke execute on function public.exportar_meus_dados() from public, anon, authenticated;
grant execute on function public.exportar_meus_dados() to authenticated;

-- ---------------------------------------------------------------------------
-- 11. A dungeon também conhece o quinto atributo
--
-- Fora dos dez passos combinados, e incluído porque sem isto o arqueiro nasce
-- estruturalmente impedido de vencer dungeon: o poder do boss é comparado com
-- a soma CRUA de Força, Inteligência e Vitalidade, e uma build inteira de
-- Destreza somaria zero ali para sempre. Seria uma punição silenciosa criada
-- pela própria rodada que promete a build.
-- ---------------------------------------------------------------------------
create or replace function public.resolver_uma_dungeon(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chave      uuid;
  v_jog        public.jogador%rowtype;
  v_attr       public.atributo_jogador%rowtype;
  v_poder      numeric;
  v_poder_boss numeric;
  v_venceu     boolean;
  v_piso       smallint;
  v_teto       smallint;
begin
  -- Consome a chave primeiro: ela é o ingresso, não a garantia de loot bom
  -- (edge case explícito da spec de origem).
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

  -- Sem aleatoriedade: perder é sinal de que falta nível, não azar.
  v_poder := 10 + v_jog.nivel + coalesce(v_attr.forca, 0)
             + coalesce(v_attr.destreza, 0)
             + coalesce(v_attr.inteligencia, 0) + coalesce(v_attr.vitalidade, 0);
  v_poder_boss := 10 + v_jog.nivel * 1.2;
  v_venceu := v_poder >= v_poder_boss;

  if v_venceu then
    v_piso := 3;   -- raro garantido
    v_teto := 10;
  else
    v_piso := 1;
    v_teto := 3;
  end if;

  perform public.conceder_item(
    p_player_id,
    case when public.sorteio01(p_player_id::text || '|dg|' || v_chave::text) < 0.3
         then 'skin' else 'arma' end,
    v_piso, v_teto, 'dungeon', coalesce(v_attr.sorte, 0)
  );

  return jsonb_build_object('resolvida', true, 'venceu', v_venceu);
end;
$$;

revoke execute on function public.resolver_uma_dungeon(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 12. Devolver os pontos de todo mundo
--
-- Precedente e motivo em `20260829_atributos_manuais.sql`: o respec é livre e
-- sem penalidade (critério 10 de `specs/ranking-global.md`), então zerar não
-- tira nada — devolve. O que muda de fato é a Vitalidade máxima, que deriva do
-- atributo, e por isso a vida atual é aparada logo abaixo: `resolver_ciclos` já
-- trataria disso no ciclo seguinte, mas até lá o retrato do herói mostraria a
-- barra estourada.
-- ---------------------------------------------------------------------------
update public.atributo_jogador
   set forca         = 0,
       destreza      = 0,
       inteligencia  = 0,
       vitalidade    = 0,
       sorte         = 0,
       atualizado_em = now();

update public.jogador j
   set vitalidade_atual = least(j.vitalidade_atual, public.vitalidade_maxima(j.nivel, 0))
 where j.vitalidade_atual > public.vitalidade_maxima(j.nivel, 0);
