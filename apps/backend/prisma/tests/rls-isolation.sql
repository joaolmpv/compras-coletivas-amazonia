-- Teste de isolamento de RLS multi-ator (OE2).
--
-- Roda inteiramente dentro de UMA transacao com ROLLBACK no final -- nao deixa
-- nenhum dado de teste no banco. Assume a migration
-- 20260925152119_enable_rls_comprador_lote_pedidolote_avaliacao ja aplicada.
--
-- Uso:
--   docker exec -i tcc_postgres psql -U postgres -d tcc_db -v ON_ERROR_STOP=1 \
--     < apps/backend/prisma/tests/rls-isolation.sql
--
-- Casos cobertos:
--   1. SET LOCAL ROLE app_comprador + SET LOCAL app.comprador_id = '<A>'
--      so ve linhas do proprio Comprador A em Comprador, PedidoLote e Avaliacao
--      -- nunca as do Comprador B.
--   2. Sem app.comprador_id setado, nao ve nenhuma linha (fail-closed) nas
--      mesmas tres tabelas.

BEGIN;

-- --- Fixtures, inseridas como postgres (superuser bypassa RLS) -------------

INSERT INTO "Comprador" (id, name, document, email, "createdAt") VALUES
  ('test_comprador_a', 'Comprador A (teste RLS)', 'RLS-TEST-DOC-A', 'rls-test-a@example.com', now()),
  ('test_comprador_b', 'Comprador B (teste RLS)', 'RLS-TEST-DOC-B', 'rls-test-b@example.com', now());

INSERT INTO "Fornecedor" (id, name, document, "createdAt") VALUES
  ('test_fornecedor_1', 'Fornecedor Teste RLS', 'RLS-TEST-DOC-F', now());

INSERT INTO "Produto" (id, name, "unitPrice", "fornecedorId", "createdAt") VALUES
  ('test_produto_1', 'Produto Teste RLS', 10.0, 'test_fornecedor_1', now());

INSERT INTO "HubLogistico" (id, name, city, "fixedDispatchCost", "variableCostPerM3", "capacityM3") VALUES
  ('test_hub_1', 'Hub Teste RLS', 'Manaus - AM', 1800, 95, 40);

INSERT INTO "Lote" (id, "produtoId", "hubId", status, "totalVolumeM3", "createdAt") VALUES
  ('test_lote_1', 'test_produto_1', 'test_hub_1', 'ABERTO', 0, now());

INSERT INTO "PedidoLote" (id, "loteId", "compradorId", "volumeM3", "costShare") VALUES
  ('test_pedido_a', 'test_lote_1', 'test_comprador_a', 5.0, 123.45),
  ('test_pedido_b', 'test_lote_1', 'test_comprador_b', 7.0, 234.56);

INSERT INTO "Avaliacao" (id, "fornecedorId", "compradorId", rating, "createdAt") VALUES
  ('test_avaliacao_a', 'test_fornecedor_1', 'test_comprador_a', 5, now()),
  ('test_avaliacao_b', 'test_fornecedor_1', 'test_comprador_b', 2, now());

-- --- Caso 1: sessao do Comprador A ------------------------------------------

SET LOCAL ROLE app_comprador;
SET LOCAL app.comprador_id = 'test_comprador_a';

DO $$
DECLARE
  cnt_comprador  int;
  cnt_pedido     int;
  cnt_avaliacao  int;
  ve_pedido_b    boolean;
  ve_avaliacao_b boolean;
BEGIN
  SELECT count(*) INTO cnt_comprador FROM "Comprador" WHERE id IN ('test_comprador_a', 'test_comprador_b');
  SELECT count(*) INTO cnt_pedido    FROM "PedidoLote" WHERE id IN ('test_pedido_a', 'test_pedido_b');
  SELECT count(*) INTO cnt_avaliacao FROM "Avaliacao"  WHERE id IN ('test_avaliacao_a', 'test_avaliacao_b');
  SELECT EXISTS(SELECT 1 FROM "PedidoLote" WHERE id = 'test_pedido_b')    INTO ve_pedido_b;
  SELECT EXISTS(SELECT 1 FROM "Avaliacao"  WHERE id = 'test_avaliacao_b') INTO ve_avaliacao_b;

  IF cnt_comprador <> 1 THEN
    RAISE EXCEPTION 'FALHA (Comprador): A deveria ver 1 linha (a propria), viu %', cnt_comprador;
  END IF;
  IF cnt_pedido <> 1 THEN
    RAISE EXCEPTION 'FALHA (PedidoLote): A deveria ver 1 linha (a propria), viu %', cnt_pedido;
  END IF;
  IF cnt_avaliacao <> 1 THEN
    RAISE EXCEPTION 'FALHA (Avaliacao): A deveria ver 1 linha (a propria), viu %', cnt_avaliacao;
  END IF;
  IF ve_pedido_b OR ve_avaliacao_b THEN
    RAISE EXCEPTION 'FALHA: Comprador A conseguiu ver linha do Comprador B (PedidoLote=%, Avaliacao=%)', ve_pedido_b, ve_avaliacao_b;
  END IF;

  RAISE NOTICE 'PASS -- caso 1: Comprador A ve so as proprias linhas (Comprador=%, PedidoLote=%, Avaliacao=%), nunca as do B', cnt_comprador, cnt_pedido, cnt_avaliacao;
END
$$;

RESET ROLE;
RESET app.comprador_id;

-- --- Caso 2: sessao sem identidade (app.comprador_id nao setado) -----------

SET LOCAL ROLE app_comprador;

DO $$
DECLARE
  cnt_comprador int;
  cnt_pedido    int;
  cnt_avaliacao int;
BEGIN
  SELECT count(*) INTO cnt_comprador FROM "Comprador" WHERE id IN ('test_comprador_a', 'test_comprador_b');
  SELECT count(*) INTO cnt_pedido    FROM "PedidoLote" WHERE id IN ('test_pedido_a', 'test_pedido_b');
  SELECT count(*) INTO cnt_avaliacao FROM "Avaliacao"  WHERE id IN ('test_avaliacao_a', 'test_avaliacao_b');

  IF cnt_comprador <> 0 OR cnt_pedido <> 0 OR cnt_avaliacao <> 0 THEN
    RAISE EXCEPTION 'FALHA: sem app.comprador_id deveria ver 0 linhas, viu Comprador=%, PedidoLote=%, Avaliacao=%', cnt_comprador, cnt_pedido, cnt_avaliacao;
  END IF;

  RAISE NOTICE 'PASS -- caso 2: sem app.comprador_id setado, nenhuma linha visivel (fail-closed)';
END
$$;

RESET ROLE;

ROLLBACK;
