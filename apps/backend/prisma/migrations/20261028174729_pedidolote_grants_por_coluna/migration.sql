-- E1 -- parte 4: restricao por coluna em PedidoLote (design-backend.md secao 4.4).
--
-- A politica pedidolote_own_insert (migration de RLS original) restringe a
-- LINHA (compradorId = o proprio), mas ate aqui nao restringia a COLUNA --
-- nada impedia que, via app_comprador, alguem inserisse um PedidoLote ja
-- com costShare preenchido. Esta e a camada 1 (Postgres) da defesa; a
-- camada 2 (Zod no DTO, sem costShare no schema de entrada) e aplicacao,
-- fica para a E4.
--
-- REVOKE total + GRANT so nas colunas permitidas, em vez de tentar REVOKE
-- so a coluna costShare (Postgres nao tem "REVOKE coluna especifica" --
-- column-level privilege so existe via GRANT explicito nas colunas
-- desejadas, substituindo o GRANT de tabela inteira).
REVOKE INSERT ON "PedidoLote" FROM app_comprador;
GRANT INSERT ("loteId", "compradorId", "volumeM3") ON "PedidoLote" TO app_comprador;
-- costShare fica de fora da lista -- app_comprador nao consegue inseri-la,
-- nem com valor explicito nem via DEFAULT (a coluna nao tem DEFAULT, so
-- aceita NULL implicito quando omitida, e so pode ser omitida porque nao e
-- NOT NULL).

-- app_comprador nunca faz UPDATE em PedidoLote em nenhuma coluna (nem
-- volumeM3) depois do INSERT -- o fechamento do lote, que preenche
-- costShare, roda como app_service (ainda nao criado nesta etapa; quando
-- for criado, precisa receber GRANT UPDATE explicito nesta tabela).
REVOKE UPDATE ON "PedidoLote" FROM app_comprador;
