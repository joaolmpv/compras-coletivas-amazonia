#!/usr/bin/env bash
# Roda os dois arquivos de teste de RLS/roles e falha (exit != 0) se
# qualquer um deles falhar.
#
#   1. rls-isolation.sql: conectado como postgres, transacional (ROLLBACK
#      no final). Sai com erro automaticamente se existir qualquer caso
#      FAIL (ver o DO final do proprio arquivo -- RAISE EXCEPTION, nao
#      precisa de grep no output).
#   2. rls-app-backend.sql: conectado DE VERDADE como app_backend (nao SET
#      ROLE a partir de postgres) -- precisa de APP_BACKEND_PASSWORD no
#      ambiente (ver apps/backend/scripts/provision-roles.sh).
set -euo pipefail
cd "$(dirname "$0")/.."

: "${APP_BACKEND_PASSWORD:?defina APP_BACKEND_PASSWORD (senha do role app_backend) antes de rodar}"

echo "== rls-isolation.sql (postgres, transacional) =="
docker exec -i tcc_postgres psql -U postgres -d tcc_db -v ON_ERROR_STOP=1 \
  < prisma/tests/rls-isolation.sql

echo
echo "== rls-app-backend.sql (conexao real como app_backend) =="
docker exec -i -e PGPASSWORD="$APP_BACKEND_PASSWORD" tcc_postgres \
  psql -U app_backend -d tcc_db -v ON_ERROR_STOP=1 \
  < prisma/tests/rls-app-backend.sql
