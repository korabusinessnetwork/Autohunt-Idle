-- ============================================================================
-- Autohunt Idle — atributo vira decisão do jogador, e vale 1 ponto por nível.
--
-- Duas mudanças de produto, pedidas pelo dono em 2026-08-13:
--
--   1. Cada level up concede UM ponto, não três.
--   2. Ninguém distribui por você. A auto-alocação sai do jogo.
--
-- A segunda desfaz uma decisão anterior desta mesma trilha: a auto-alocação
-- nasceu para servir o Princípio nº1 ("quem nunca abrir a tela joga com uma
-- build coerente"). Na prática ela virou o contrário — o jogador subia de
-- nível, os quatro atributos subiam sozinhos, e a tela de atributos não tinha
-- nenhuma decisão dentro. O Princípio nº1 continua atendido, por outro caminho:
-- o ícone de atributos carrega o selo com os pontos livres (`Jogo.tsx`), então
-- "tem coisa pra fazer aqui" aparece sem exigir leitura, e ignorar o selo não
-- quebra nada — só deixa ponto guardado.
--
-- POR QUE ESTA MIGRATION ZERA A ALOCAÇÃO DE TODO MUNDO
--
-- O bolo de pontos encolheu três vezes. Um jogador de nível 20 tinha ganho 57
-- pontos e provavelmente gastou os 57; com a regra nova ele ganhou 19. A
-- alocação antiga custa mais do que os pontos que existem, e o jogador ficaria
-- com saldo negativo — sem conseguir salvar nada, porque `redistribuir_atributos`
-- confere o custo acumulado contra os pontos ganhos.
--
-- Zerar não tira nada de ninguém: o respec é livre e sem penalidade (critério
-- 10 de `specs/ranking-global.md`), então os pontos voltam inteiros para o
-- jogador gastar do jeito dele. O que muda de fato é a Vitalidade máxima, que
-- deriva do atributo — por isso a vida atual é aparada logo abaixo.
--
-- Espelhado em `src/game/regrasAtributos.ts` (PONTOS_POR_NIVEL), com alarme em
-- `src/game/espelhoDeRegra.test.ts`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Um ponto por nível.
-- ---------------------------------------------------------------------------
create or replace function public.pontos_ganhos_ate(p_nivel bigint)
returns bigint
language sql
immutable
as $$
  select greatest(0, p_nivel - 1) * 1;
$$;

comment on function public.pontos_ganhos_ate(bigint) is
  'Pontos de atributo que um jogador daquele nível já ganhou na vida: 1 por level up.';

-- ---------------------------------------------------------------------------
-- 2. A auto-alocação para de alocar.
--
-- A função continua existindo, e de propósito: `validar_lote`, `iniciar_dungeon`
-- e `ativar_passe` a chamam com `perform` quando o jogador sobe de nível.
-- Trocar o corpo desliga o comportamento em um lugar só, sem reescrever RPC
-- nenhuma — e sem deixar `perform` apontando para função inexistente.
--
-- O que sobra dela é o único efeito de que os chamadores dependem: garantir que
-- a linha de atributo existe.
-- ---------------------------------------------------------------------------
create or replace function public.auto_alocar_atributos(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.atributo_jogador (player_id) values (p_player_id)
  on conflict (player_id) do nothing;
end;
$$;

comment on function public.auto_alocar_atributos(uuid) is
  'Só garante a linha de atributo. A distribuição automática saiu do jogo em 2026-08-13: quem gasta ponto é o jogador.';

revoke execute on function public.auto_alocar_atributos(uuid) from public, anon, authenticated;

-- A porta de volta para o automático deixa de existir junto com o automático.
drop function if exists public.reativar_auto_alocacao();

-- Coluna mantida por compatibilidade com o snapshot e com o export de dados da
-- LGPD, que já a listam. Nasce falsa, e nada mais a lê para decidir.
alter table public.atributo_jogador alter column auto_alocar set default false;

comment on column public.atributo_jogador.auto_alocar is
  'Herança da auto-alocação, removida em 2026-08-13. Sempre falsa; mantida porque montar_snapshot e exportar_meus_dados a publicam.';

-- ---------------------------------------------------------------------------
-- 3. Devolver os pontos de todo mundo.
-- ---------------------------------------------------------------------------
update public.atributo_jogador
   set forca         = 0,
       inteligencia  = 0,
       vitalidade    = 0,
       sorte         = 0,
       auto_alocar   = false,
       atualizado_em = now();

-- Sem o atributo Vitalidade, o teto de vida cai — e quem estava com a vida
-- cheia ficaria acima do próprio máximo. `resolver_ciclos` já trata isso no
-- ciclo seguinte, mas o retrato do herói mostraria a barra estourada até lá.
update public.jogador j
   set vitalidade_atual = least(j.vitalidade_atual, public.vitalidade_maxima(j.nivel, 0))
 where j.vitalidade_atual > public.vitalidade_maxima(j.nivel, 0);
