-- GRANTs de app_auth (login, refresh, logout, cadastro -- design-backend.md
-- secao 12.1.2). Usuario, Fornecedor e SessaoRefreshToken nunca tiveram
-- RLS habilitado -- os GRANTs abaixo bastam, sem politica.
GRANT SELECT ON "Usuario" TO app_auth;
GRANT INSERT ON "Usuario" TO app_auth;
GRANT INSERT ON "Comprador" TO app_auth;
GRANT INSERT ON "Fornecedor" TO app_auth;
GRANT INSERT, UPDATE ON "SessaoRefreshToken" TO app_auth;
-- SELECT em SessaoRefreshToken: adicao ao que foi pedido literalmente
-- (so listava INSERT/UPDATE) -- sem SELECT, nem o refresh roda: um
-- UPDATE ... WHERE "hashToken" = $1 exige privilegio de leitura sobre a
-- coluna lida no WHERE, mesmo que a intencao seja so escrever.
GRANT SELECT ON "SessaoRefreshToken" TO app_auth;
GRANT INSERT ON "LogAuditoria" TO app_auth;

-- Comprador tem FORCE ROW LEVEL SECURITY desde a migration original de
-- RLS, que NUNCA teve uma politica de INSERT -- o proprio comentario
-- daquela migration ja apontava isso como pendencia ("Cadastro (INSERT)
-- fica fora desta politica"). Esta migration resolve a pendencia,
-- escopada a app_auth (nao a um BYPASSRLS generico).
CREATE POLICY comprador_insert_cadastro ON "Comprador"
  FOR INSERT TO app_auth WITH CHECK (true);
