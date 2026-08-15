#!/usr/bin/env bash
#
# Sobe um Postgres descartável, aplica todas as migrations em ordem e roda o
# teste de fumaça.
#
# Por que isto existe: `src/lib/contratoRpc.test.ts` audita o TEXTO do SQL, e
# isso não pega erro de tipo, constraint que não pega, índice parcial que não
# aplica nem forma fechada que diverge do somatório. Só executando pega.
#
#   ./scripts/pg-local.sh          sobe, aplica, testa e derruba
#   ./scripts/pg-local.sh --manter deixa o banco de pé para inspecionar
#
# Requer os binários do Postgres (pacote postgresql-16 ou equivalente).
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Onde estão os binários. A 16 é a versão de referência (a mesma que o Supabase
# roda), mas exigir exatamente ela travaria o script em máquina que só tem a 15
# ou a 17 — e no CI a versão pré-instalada muda sem aviso quando a imagem do
# runner é atualizada. Sem PGBIN no ambiente, pega a maior instalada.
if [[ -z "${PGBIN:-}" ]]; then
  for v in $(ls /usr/lib/postgresql 2>/dev/null | sort -rn); do
    if [[ -x "/usr/lib/postgresql/$v/bin/initdb" ]]; then
      PGBIN="/usr/lib/postgresql/$v/bin"
      break
    fi
  done
fi
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PORTA="${PGPORT:-5433}"
BASE="${PGTMP:-/tmp/autohunt-pg}"
PGDATA="$BASE/data"
SOCK="$BASE/sock"
MANTER=false
[[ "${1:-}" == "--manter" ]] && MANTER=true

if [[ ! -x "$PGBIN/initdb" ]]; then
  echo "✗ binários do Postgres não encontrados em $PGBIN"
  echo "  instale o postgresql-16 ou aponte PGBIN para o diretório correto."
  exit 1
fi

# O Postgres recusa rodar como root. Quando for o caso, delega a um usuário
# dedicado — é o cenário de container, não o de máquina de desenvolvedor.
COMO=""
if [[ "$(id -u)" == "0" ]]; then
  id pgtest >/dev/null 2>&1 || useradd -m pgtest
  COMO="su pgtest -c"
  BASE="/home/pgtest/autohunt-pg"
  PGDATA="$BASE/data"
  SOCK="$BASE/sock"
fi

rodar() { if [[ -n "$COMO" ]]; then $COMO "$1"; else bash -c "$1"; fi; }

limpar() {
  rodar "$PGBIN/pg_ctl -D $PGDATA stop -m immediate" >/dev/null 2>&1 || true
  rm -rf "$BASE"
}
$MANTER || trap limpar EXIT

rm -rf "$BASE"
mkdir -p "$PGDATA" "$SOCK"
[[ -n "$COMO" ]] && chown -R pgtest "$BASE"

echo "→ subindo Postgres em $PGDATA (porta $PORTA)"
rodar "$PGBIN/initdb -D $PGDATA -U postgres --auth=trust -E UTF8" >/dev/null
rodar "$PGBIN/pg_ctl -D $PGDATA -l $BASE/pg.log -o '-k $SOCK -p $PORTA -c listen_addresses=' -w start" >/dev/null

PSQL="$PGBIN/psql -h $SOCK -p $PORTA -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL -c "create database autohunt;" >/dev/null
PSQL="$PSQL -d autohunt"

echo "→ aplicando o stub do Supabase"
$PSQL -f "$RAIZ/scripts/stub-supabase.sql" >/dev/null

echo "→ aplicando as migrations"
for m in "$RAIZ"/supabase/migrations/*.sql; do
  printf '   %-46s ' "$(basename "$m")"
  # Os NOTICE de "does not exist, skipping" são esperados: as migrations usam
  # `drop ... if exists` para poderem ser reaplicadas.
  if $PSQL -f "$m" >/dev/null 2>"$BASE/erro.txt"; then
    echo "ok"
  else
    echo "FALHOU"
    sed 's/^/      /' "$BASE/erro.txt" | head -20
    exit 1
  fi
done

echo "→ rodando o teste de fumaça"
# UMA execução só, e o código de saída dela é o veredito.
#
# Rodava duas vezes: a primeira para mostrar o progresso (com o `grep` do
# resultado descartado por um `|| true`) e a segunda, calada, para decidir o
# resultado. Só que `teste-migrations.sql` NÃO é idempotente — ele insere os
# jogadores de teste com UUID fixo em `auth.users` — então a segunda execução
# sempre morria em chave duplicada e o script nunca saía com 0, mesmo com todas
# as verificações passando. Era o CI vermelho desde que este script nasceu.
#
# Guardar a saída em arquivo e filtrá-la depois dá o mesmo progresso na tela sem
# pipeline nenhum no caminho do código de saída.
FUMACA="$BASE/fumaca.txt"
if $PGBIN/psql -h "$SOCK" -p "$PORTA" -U postgres -d autohunt -v ON_ERROR_STOP=1 \
     -f "$RAIZ/scripts/teste-migrations.sql" >"$FUMACA" 2>&1; then
  grep -E "^(==)|VERIFICAÇÕES" "$FUMACA" || true
else
  grep -E "^(==|psql.*(ERROR|FALHOU))" "$FUMACA" | head -30
  echo "✗ o teste de fumaça falhou"
  exit 1
fi

echo "✓ migrations aplicam e o teste de fumaça passa"

# `if`, e não `$MANTER && echo ...`: sem `--manter` a forma curta devolve 1, e
# como esta é a ÚLTIMA linha do arquivo, o 1 virava o código de saída do script
# inteiro. Sucesso que sai 1 é falha para quem chama — o CI incluído.
if $MANTER; then
  echo "  banco mantido de pé: $PGBIN/psql -h $SOCK -p $PORTA -U postgres -d autohunt"
fi

exit 0
