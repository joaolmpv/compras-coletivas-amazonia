#!/usr/bin/env bash
# Define a senha do role app_backend FORA de qualquer migration (migrations
# vao pro git; a senha nunca deve). Ver design-backend.md secao 12.3.
#
# A migration de roles (20261029191810_roles_app_backend_...) cria
# app_backend SEM senha -- rodar este script e o que torna o LOGIN
# realmente possivel.
#
# Uso:
#   APP_BACKEND_PASSWORD='...' DIRECT_URL='postgresql://postgres:...@host:5432/db' \
#     bash apps/backend/scripts/provision-roles.sh
set -euo pipefail

: "${APP_BACKEND_PASSWORD:?defina APP_BACKEND_PASSWORD antes de rodar este script}"
: "${DIRECT_URL:?defina DIRECT_URL (conexao com privilegio de ALTER ROLE) antes de rodar}"

# -v pw=... + :'pw' e a sintaxe de variavel do psql com quoting seguro de
# literal de string -- a senha nunca e interpolada diretamente na string
# SQL pelo shell (isso seria uma injecao de SQL esperando pra acontecer se
# a senha tivesse um caractere ' dentro). O psql faz o escaping.
#
# Importante: a substituicao de :'pw' SO funciona com o SQL entrando via
# stdin/-f (o psql processa o buffer de comando normal) -- com `-c`, o
# texto e enviado ao servidor sem passar pela interpolacao de variaveis do
# cliente (confirmado empiricamente nesta versao do psql: -c da erro de
# sintaxe no ":'pw'" literal). Por isso o SQL vai por um heredoc, nao por -c.
psql "$DIRECT_URL" -v pw="$APP_BACKEND_PASSWORD" <<'SQL'
ALTER ROLE app_backend PASSWORD :'pw';
SQL

echo "Senha de app_backend atualizada."
