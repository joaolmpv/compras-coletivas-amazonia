-- GRANTs minimos de app_service (design-backend.md secao 12.1.1, escopo
-- reduzido na aprovacao: sem Avaliacao.sentimentScore, sem Lote.status,
-- sem Comprador -- ficam para E4/OE4, cada um com seu proprio GRANT+teste
-- quando o codigo que os usa existir).
GRANT UPDATE ("costShare") ON "PedidoLote" TO app_service;

GRANT SELECT, INSERT ON "Pagamento" TO app_service;
GRANT UPDATE ("status", "updatedAt") ON "Pagamento" TO app_service;
-- valor, pedidoLoteId, gatewayRef ficam de fora do UPDATE -- imutaveis
-- depois do INSERT.

GRANT SELECT, INSERT ON "Repasse" TO app_service;
GRANT UPDATE ("status") ON "Repasse" TO app_service;
-- Repasse nao tem coluna updatedAt no schema.

GRANT INSERT ON "LogAuditoria" TO app_service;
-- so INSERT -- nunca UPDATE/DELETE/TRUNCATE, mesma regra de app_comprador
-- e de qualquer outro role (ver REVOKE/triggers da migration de auditoria).

-- PedidoLote tem FORCE ROW LEVEL SECURITY -- GRANT sozinho nao basta,
-- precisa de uma politica explicita permitindo o UPDATE (em vez de
-- BYPASSRLS, que exige superuser para criar o role e pode nao ser
-- permitido livremente em Postgres gerenciado -- ver secao 12.2).
-- Pagamento/Repasse NAO tem FORCE RLS (nunca foi habilitado nelas), entao
-- os GRANTs acima bastam sem politica.
CREATE POLICY app_service_update_costshare ON "PedidoLote"
  FOR UPDATE TO app_service USING (true) WITH CHECK (true);
