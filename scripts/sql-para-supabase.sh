#!/usr/bin/env bash
#
# Concatena todas as migrations em UM arquivo, em ordem cronológica, para colar
# de uma vez no SQL editor do Supabase.
#
# POR QUE EXISTE: são 17 migrations, e a ordem importa — várias redefinem
# funções de migrations anteriores (`iniciar_sessao` foi reescrita cinco vezes).
# Colar arquivo por arquivo é onde se erra a ordem ou se pula um, e o erro só
# aparece muito depois, como comportamento estranho em vez de falha.
#
# O arquivo gerado NÃO é commitado de propósito: arquivo gerado que dorme no
# repositório envelhece em silêncio quando uma migration nova entra. Gere na
# hora de usar.
#
#   ./scripts/sql-para-supabase.sh > autohunt.sql
#
# Depois: SQL editor do Supabase → colar → Run. Uma vez só, e na ordem certa.
#
# TUDO SAI DENTRO DE UMA TRANSAÇÃO, e isso não é detalhe: no Postgres o DDL é
# transacional, então se qualquer coisa falhar no meio o banco volta ao que era.
# Sem isso, uma falha na linha 4000 deixaria o projeto meio migrado — o pior
# estado possível, porque parece que funcionou.
#
# Alternativa para quem tem a CLI (`supabase link` + `supabase db push`): use a
# CLI. Ela guarda o histórico de migrations no projeto, o que este arquivo não
# faz — este aqui é o caminho sem instalar nada.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cat <<'CABECALHO'
-- ============================================================================
-- Autohunt Idle — schema completo, gerado por scripts/sql-para-supabase.sh
--
-- Cole isto INTEIRO no SQL editor do Supabase e rode uma vez. As migrations
-- estão na ordem cronológica em que precisam ser aplicadas.
--
-- RODE UMA VEZ, NUM PROJETO NOVO. Este arquivo é o histórico completo, e o
-- histórico não é re-executável: a migration 20260818 trocou `item_jogador.equipado`
-- por `slot`, então uma migration anterior cria um índice sobre uma coluna que,
-- num banco já migrado, não existe mais. Verificado — não é suposição.
--
-- Por isso tudo aqui roda DENTRO DE UMA TRANSAÇÃO: se falhar no meio, o banco
-- volta exatamente ao que era. Um projeto meio migrado é o pior estado
-- possível, porque parece que funcionou.
--
-- Para EVOLUIR um banco que já tem o schema, aplique só a migration nova —
-- nunca este arquivo de novo.
--
-- NÃO EDITE ESTE ARQUIVO. A fonte é `supabase/migrations/` — edite lá e gere
-- de novo, senão o banco e o repositório contam histórias diferentes.
-- ============================================================================

begin;

CABECALHO

for m in "$RAIZ"/supabase/migrations/*.sql; do
  printf -- '-- ############################################################################\n'
  printf -- '-- ## %s\n' "$(basename "$m")"
  printf -- '-- ############################################################################\n\n'
  cat "$m"
  printf '\n\n'
done

cat <<'RODAPE'
commit;

-- ============================================================================
-- Fim. Dois passos manuais que o SQL não faz sozinho:
--
-- 1. Habilitar `signInAnonymously` no painel de Auth. Sem isso o jogo abre na
--    tela de erro e ninguém joga — a conta anônima é como toda sessão começa.
--
-- 2. Depois de entrar no jogo uma vez (o que cria a sua linha em `jogador`),
--    promover a sua conta a admin para o console `/console` funcionar:
--
--      update public.jogador set admin = true where id = '<uuid da sua conta>';
--
--    O uuid sai de `select id, criado_em from public.jogador order by criado_em;`
--    ou do painel de Auth → Users.
-- ============================================================================
RODAPE
