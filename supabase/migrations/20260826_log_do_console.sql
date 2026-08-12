-- ============================================================================
-- Autohunt Idle — o log operacional do console.
--
-- POR QUE EXISTE: o console de ajuste (migration 20260825) grava em
-- `evento_jogo` quem mexeu em qual número, quando, e de quanto para quanto —
-- **e ninguém consegue ler**. Um log que existe só para auditoria e não tem por
-- onde auditar não é log, é dívida.
--
-- E é a peça que o mercado P2P vai precisar: `docs/11_SEGURANCA/plano-mercado-p2p.md`
-- §4.6 exige rastro completo de toda listagem, compra e cancelamento. Quando o
-- mercado nascer, `mercado.listado` e `mercado.comprado` entram na lista de
-- tipos aqui embaixo e aparecem nesta mesma tela. **A escrita do rastro nasce
-- dentro da RPC do trade, na mesma transação — nunca depois**, porque trade que
-- rodou antes do log existir é trade que ninguém consegue investigar.
--
-- ============================================================================
-- A DECISÃO QUE MOLDA ESTA MIGRATION: o admin NÃO ganha leitura de `evento_jogo`
--
-- O caminho fácil seria uma policy de RLS `using (public.e_admin())`. Ela foi
-- recusada: `evento_jogo.dados` é `jsonb` livre e o client tem `grant insert`
-- (dívida D10), então "admin lê a tabela" significa **admin lê tudo o que
-- qualquer jogador já registrou, inclusive o que ainda nem foi inventado**.
-- Isso é vigilância, não auditoria.
--
-- No lugar disso: uma RPC `SECURITY DEFINER` com **lista fechada de tipos**,
-- declarada aqui no servidor. O que não está na lista não sai, nem que o client
-- peça pelo nome. Mesmo raciocínio da lista fechada de RPCs.
--
-- A linha que separa os dois lados: **entra no log o evento que MOVE VALOR ou
-- MUDA A CONFIGURAÇÃO do jogo.** Presença, progressão e escolha pessoal ficam
-- de fora — `farm.calculado` diria quando cada pessoa jogou e por quanto tempo,
-- e `atributo.redistribuido` diria como ela monta o personagem. Nenhum dos dois
-- é operação; os dois são comportamento.
-- ============================================================================

create or replace function public.tipos_do_log_operacional()
returns text[]
language sql
immutable
as $$
  select array[
    -- Configuração do jogo (console de ajuste)
    'ajuste.aplicado',
    'ajuste.recusado',
    'console.log_recusado',
    -- Dinheiro real entrando
    'diamante.creditado',
    'passe.ativado',
    'passe.desativado',
    'assinatura.vencida',
    'anuncio.creditado',
    -- Valor circulando dentro do jogo
    'ouro.comprado',
    'item.fortificado',
    'item.sintetizado',
    'dungeon.resolvida'
  ]::text[];
$$;

comment on function public.tipos_do_log_operacional() is
  'Lista FECHADA do que o log do console mostra. Move valor ou muda configuração — nunca presença nem progressão.';

revoke execute on function public.tipos_do_log_operacional() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- log_operacional — a leitura do rastro
--
-- Paginação por cursor de tempo (`p_antes`) em vez de `offset`: o log só cresce
-- pela ponta nova, e `offset` faria a página 2 repetir linha toda vez que um
-- evento entrasse no meio da leitura.
--
-- `p_tipos` é filtro de conveniência da tela, e é **intersectado** com a lista
-- fechada — pedir um tipo de fora não amplia nada, só devolve menos.
-- ---------------------------------------------------------------------------
create or replace function public.log_operacional(
  p_tipos  text[]      default null,
  p_limite integer     default 50,
  p_antes  timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_limite_maximo constant integer := 200;

  v_uid      uuid := auth.uid();
  v_permitidos text[] := public.tipos_do_log_operacional();
  v_filtro   text[];
  v_limite   integer;
  v_eventos  jsonb;
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  -- Tentar ler o log de auditoria é, por si só, o tipo de coisa que se quer
  -- auditar. Por isso a recusa é DEVOLVIDA e não levantada: `raise` derrubaria
  -- a transação e apagaria o registro da tentativa junto.
  if not public.e_admin() then
    insert into public.evento_jogo (player_id, tipo, dados)
    values (v_uid, 'console.log_recusado', jsonb_build_object('motivo', 'NAO_AUTORIZADO'));
    return jsonb_build_object('permitido', false, 'motivo', 'NAO_AUTORIZADO');
  end if;

  -- A interseção é o que torna `p_tipos` inofensivo: o client escolhe DENTRO da
  -- lista, nunca acrescenta a ela.
  v_filtro := case
                when p_tipos is null or cardinality(p_tipos) = 0 then v_permitidos
                else array(select unnest(v_permitidos) intersect select unnest(p_tipos))
              end;

  v_limite := least(greatest(coalesce(p_limite, 50), 1), c_limite_maximo);

  select coalesce(jsonb_agg(linha order by (linha ->> 'em') desc), '[]'::jsonb)
    into v_eventos
    from (
      select jsonb_build_object(
               'id',      e.id,
               'em',      e.criado_em,
               'tipo',    e.tipo,
               'jogador', e.player_id,
               'apelido', j.apelido,
               'dados',   e.dados
             ) as linha
        from public.evento_jogo e
        left join public.jogador j on j.id = e.player_id
       where e.tipo = any(v_filtro)
         and (p_antes is null or e.criado_em < p_antes)
       order by e.criado_em desc, e.id desc
       limit v_limite
    ) as pagina;

  return jsonb_build_object(
    'permitido', true,
    'eventos',   v_eventos,
    -- A tela mostra a lista para quem lê saber o que NÃO está sendo mostrado.
    -- Log com recorte invisível engana mais do que log nenhum.
    'tipos',     to_jsonb(v_permitidos),
    'limite',    v_limite
  );
end;
$$;

revoke execute on function public.log_operacional(text[], integer, timestamptz) from public, anon;
grant execute on function public.log_operacional(text[], integer, timestamptz) to authenticated;

-- O índice que a consulta usa. O existente é `(player_id, criado_em desc)`, e
-- serve para o jogador ler os próprios eventos; este log varre por TIPO e
-- tempo, cruzando jogadores.
create index if not exists evento_jogo_tipo_idx
  on public.evento_jogo (tipo, criado_em desc);
