-- RLS em HubLogistico (decisao 23/11/2026, proposta 3/3) -- defesa em
-- profundidade: HubLogistico nunca teve RLS, so GRANT simples (ver
-- design-backend.md secao 7, item 4: "RLS habilitado em todas as
-- tabelas, inclusive catalogo"). Catalogo publico (sem escrita via API)
-- -- a politica e so leitura, sem identidade por linha.
--
-- Achado ao escrever esta migration: so app_comprador tinha GRANT SELECT
-- (migration 20260925152119). app_fornecedor e app_service nunca
-- receberam -- sem o GRANT, a politica abaixo nao teria efeito pra eles
-- (GRANT continua sendo o primeiro portao, a politica so filtra LINHAS
-- de quem ja passou pelo GRANT). Concedido aqui junto.
GRANT SELECT ON "HubLogistico" TO app_fornecedor;
GRANT SELECT ON "HubLogistico" TO app_service;

ALTER TABLE "HubLogistico" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HubLogistico" FORCE ROW LEVEL SECURITY;

-- Uma politica so, tres roles -- nenhum deles tem identidade propria
-- relevante pra filtrar HubLogistico por linha (nao e dado de ninguem
-- em particular, e o catalogo de hubs em si).
CREATE POLICY hub_select_catalogo ON "HubLogistico"
  FOR SELECT TO app_comprador, app_fornecedor, app_service
  USING (true);
