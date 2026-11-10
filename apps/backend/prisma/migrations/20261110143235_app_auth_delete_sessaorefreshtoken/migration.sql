-- E2: grant necessario para o job de limpeza de SessaoRefreshToken
-- (DEVELOPMENT.md E2, "Model SessaoRefreshToken ... job de limpeza").
-- app_auth ja tem SELECT/INSERT/UPDATE nesta tabela desde a E1 -- faltava
-- DELETE, que nenhum role tinha ainda (so o dono, postgres).
GRANT DELETE ON "SessaoRefreshToken" TO app_auth;
