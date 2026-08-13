-- ============================================================================
-- 20260828 — o inimigo passou a dar dano, e o dono precisa regular isso
--
-- Implementa o pedaço de servidor de `specs/mapas-instanciados-combate-e-hud.md`
-- (seção 1). E é literalmente só isto: uma linha de catálogo.
--
-- POR QUE UMA MIGRATION PARA UM NÚMERO DE TELA
--
-- `ajustes.ts` e o catálogo de `ajuste` são espelhos um do outro, e um teste
-- (`src/game/ajustes.test.ts`) reprova o build quando divergem — nem chave a
-- mais no client, nem a menos. Isso existe para o dono nunca mexer num controle
-- que não chega a lugar nenhum. Portanto: chave nova no client, linha nova
-- aqui.
--
-- O QUE ESTE NÚMERO NÃO É
--
-- Escopo `visual`, como os outros oito. Ele decide quanto a barra de vitalidade
-- da TELA cai quando um monstro encosta no herói — e nada mais. A vitalidade
-- que decide ciclo perdido continua sendo a do banco, movida por
-- `dano_por_ciclo_base` (escopo `economico`, que nunca sai daqui) dentro de
-- `resolver_ciclos`.
--
-- São dois números parecidos de propósito separados: um o jogador vê cair, o
-- outro credita. Se um dia se juntarem, o navegador do jogador passa a mexer em
-- recompensa — que é exatamente o que o projeto inteiro é construído para
-- impedir.
-- ============================================================================

insert into public.ajuste (chave, valor, minimo, maximo, escopo, categoria, descricao) values
  ('inimigo_dano', 6, 0, 100, 'visual', 'inimigo',
   'Dano de um golpe de inimigo NA TELA. Cada espécie multiplica isto (a Trufa bate 2x, o Floco 0,8x). Não altera recompensa: quem decide ciclo perdido é dano_por_ciclo_base, no servidor.')
on conflict (chave) do nothing;
