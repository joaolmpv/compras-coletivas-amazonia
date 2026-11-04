-- Correcao: UPDATE "PedidoLote" SET "costShare" = ... WHERE id = $1 exige
-- SELECT na coluna lida no WHERE (id), mesmo so escrevendo costShare --
-- mesma classe de bug ja corrigida para app_auth/SessaoRefreshToken.
-- Descoberta pelo proprio teste (rls-isolation.sql caso 9), nao em producao.
GRANT SELECT ON "PedidoLote" TO app_service;

-- A politica anterior (app_service_update_costshare) so cobria FOR UPDATE
-- -- isso filtra quais linhas PODEM ser atualizadas, mas nao da
-- visibilidade de SELECT (que o proprio WHERE do UPDATE tambem precisa,
-- e que uma query de SELECT separada precisaria). Troca para FOR ALL --
-- o GRANT continua sendo o que realmente limita os verbos (so SELECT +
-- UPDATE(costShare) foram concedidos), a politica so governa visibilidade
-- de linha.
DROP POLICY app_service_update_costshare ON "PedidoLote";
CREATE POLICY app_service_full_rows ON "PedidoLote"
  FOR ALL TO app_service USING (true) WITH CHECK (true);
