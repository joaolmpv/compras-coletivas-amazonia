-- E1 -- correcao da migration anterior (pedidolote_grants_por_coluna):
-- faltava GRANT INSERT na coluna "id". O @default(cuid()) do Prisma e
-- gerado no CLIENTE (nao e um DEFAULT do Postgres, diferente de
-- @default(now())) -- toda INSERT que o Prisma Client realmente emite
-- inclui "id" explicitamente na lista de colunas. Sem essa coluna no
-- GRANT, qualquer INSERT (mesmo um valido, sem costShare) falha com
-- "permission denied for table PedidoLote" -- descoberto pelo teste de
-- isolamento estendido (caso 3b), nao em produção.
REVOKE INSERT ON "PedidoLote" FROM app_comprador;
GRANT INSERT ("id", "loteId", "compradorId", "volumeM3") ON "PedidoLote" TO app_comprador;
