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
--   3. (E1) GRANT por coluna em PedidoLote: app_comprador NAO consegue
--      inserir costShare, nem fazer UPDATE em nenhuma coluna; consegue
--      inserir normalmente sem costShare.
--   4. (E1) fn_breakdown_lote: retorna a linha do proprio comprador
--      identificada e a(s) linha(s) de outros participantes com
--      comprador_id anonimizado (NULL), nunca o id de outro comprador.

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
  ('test_lote_1', 'test_produto_1', 'test_hub_1', 'ABERTO', 0, now()),
  ('test_lote_2', 'test_produto_1', 'test_hub_1', 'ABERTO', 0, now());

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

-- --- Caso 3: GRANT por coluna em PedidoLote (E1, design-backend.md 4.4) ----

SET LOCAL ROLE app_comprador;
SET LOCAL app.comprador_id = 'test_comprador_a';

DO $$
DECLARE
  falhou_como_esperado boolean := false;
BEGIN
  BEGIN
    INSERT INTO "PedidoLote" (id, "loteId", "compradorId", "volumeM3", "costShare")
    VALUES ('test_pedido_coluna_bloqueado', 'test_lote_2', 'test_comprador_a', 3.0, 999.99);
  EXCEPTION WHEN insufficient_privilege THEN
    falhou_como_esperado := true;
  END;

  IF NOT falhou_como_esperado THEN
    RAISE EXCEPTION 'FALHA: app_comprador conseguiu inserir PedidoLote com costShare preenchido (GRANT por coluna nao esta bloqueando)';
  END IF;

  RAISE NOTICE 'PASS -- caso 3a: app_comprador NAO consegue inserir costShare (GRANT por coluna)';
END
$$;

DO $$
BEGIN
  INSERT INTO "PedidoLote" (id, "loteId", "compradorId", "volumeM3")
  VALUES ('test_pedido_coluna_ok', 'test_lote_2', 'test_comprador_a', 3.0);

  RAISE NOTICE 'PASS -- caso 3b: app_comprador consegue inserir sem costShare (volumeM3 apenas)';
END
$$;

DO $$
DECLARE
  falhou_como_esperado boolean := false;
BEGIN
  BEGIN
    UPDATE "PedidoLote" SET "volumeM3" = 999 WHERE id = 'test_pedido_coluna_ok';
  EXCEPTION WHEN insufficient_privilege THEN
    falhou_como_esperado := true;
  END;

  IF NOT falhou_como_esperado THEN
    RAISE EXCEPTION 'FALHA: app_comprador conseguiu fazer UPDATE em PedidoLote (REVOKE UPDATE nao esta bloqueando)';
  END IF;

  RAISE NOTICE 'PASS -- caso 3c: app_comprador NAO consegue UPDATE em PedidoLote (REVOKE UPDATE)';
END
$$;

RESET ROLE;
RESET app.comprador_id;

-- --- Caso 4: fn_breakdown_lote anonimiza os demais participantes (E1) ------

SET LOCAL ROLE app_comprador;
SET LOCAL app.comprador_id = 'test_comprador_a';

DO $$
DECLARE
  linha           record;
  minha_linha_ok  boolean := false;
  vazou_id_de_b   boolean := false;
  total_linhas    int := 0;
BEGIN
  FOR linha IN SELECT * FROM fn_breakdown_lote('test_lote_1') LOOP
    total_linhas := total_linhas + 1;
    IF linha.comprador_id = 'test_comprador_a'
       AND linha.volume_m3 = 5.0 AND linha.cost_share = 123.45 THEN
      minha_linha_ok := true;
    END IF;
    IF linha.comprador_id = 'test_comprador_b' THEN
      vazou_id_de_b := true;
    END IF;
  END LOOP;

  IF NOT minha_linha_ok THEN
    RAISE EXCEPTION 'FALHA: fn_breakdown_lote nao retornou a linha identificada do proprio Comprador A';
  END IF;
  IF vazou_id_de_b THEN
    RAISE EXCEPTION 'FALHA: fn_breakdown_lote vazou o compradorId do Comprador B';
  END IF;
  IF total_linhas <> 2 THEN
    RAISE EXCEPTION 'FALHA: fn_breakdown_lote deveria retornar 2 linhas (totais do lote), retornou %', total_linhas;
  END IF;

  RAISE NOTICE 'PASS -- caso 4: fn_breakdown_lote retorna % linhas do lote, propria identificada, Comprador B anonimizado', total_linhas;
END
$$;

RESET ROLE;
RESET app.comprador_id;

ROLLBACK;
