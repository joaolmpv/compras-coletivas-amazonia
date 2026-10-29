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
--   4. (E1, revisado no PR #1) fn_breakdown_lote: fail-closed sem identidade;
--      zero linhas se o comprador nao participa do lote; propria linha
--      identificada e demais anonimizadas se participa; funcao continua
--      lendo a tabela real mesmo se app_comprador criar uma tabela
--      temporaria chamada "PedidoLote" na propria sessao (ataque de
--      search_path/pg_temp contra SECURITY DEFINER).
--   5. (E1) GRANT por coluna em Avaliacao: app_comprador NAO consegue
--      inserir sentimentScore.
--   6. (E1) has_table_privilege(app_comprador, SELECT) = false para
--      Usuario, SessaoRefreshToken, LogAuditoria, Pagamento, Repasse.
--   7. (E1) CHECK papel<->perfil de Usuario -- todos os ramos (aceitos e
--      rejeitados).
--   8. (E1) LogAuditoria: UPDATE, DELETE e TRUNCATE todos bloqueados.

BEGIN;

-- --- Fixtures, inseridas como postgres (superuser bypassa RLS) -------------

INSERT INTO "Comprador" (id, name, document, email, "createdAt") VALUES
  ('test_comprador_a', 'Comprador A (teste RLS)', 'RLS-TEST-DOC-A', 'rls-test-a@example.com', now()),
  ('test_comprador_b', 'Comprador B (teste RLS)', 'RLS-TEST-DOC-B', 'rls-test-b@example.com', now()),
  ('test_comprador_c', 'Comprador C -- nao participa de nenhum lote (teste RLS)', 'RLS-TEST-DOC-C', 'rls-test-c@example.com', now());

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

-- --- Caso 4: fn_breakdown_lote (E1, revisado no PR #1) ---------------------
-- Daqui em diante, cada DO $$ captura a propria falha (nao usa RAISE
-- EXCEPTION pra abortar o script) e imprime PASS ou FAIL -- um caso por
-- linha, pra dar pra ver o relatorio completo numa unica execucao.

-- 4a: sem identidade -> 0 linhas (fail-closed)
SET LOCAL ROLE app_comprador;
DO $$
DECLARE
  total int;
BEGIN
  SELECT count(*) INTO total FROM fn_breakdown_lote('test_lote_1');
  IF total = 0 THEN
    RAISE NOTICE 'PASS -- caso 4a: breakdown sem identidade retorna 0 linhas';
  ELSE
    RAISE NOTICE 'FAIL -- caso 4a: breakdown sem identidade retornou % linhas (esperado 0)', total;
  END IF;
END
$$;
RESET ROLE;

-- 4b: comprador que NAO participa do lote -> 0 linhas
SET LOCAL ROLE app_comprador;
SET LOCAL app.comprador_id = 'test_comprador_c';
DO $$
DECLARE
  total int;
BEGIN
  SELECT count(*) INTO total FROM fn_breakdown_lote('test_lote_1');
  IF total = 0 THEN
    RAISE NOTICE 'PASS -- caso 4b: breakdown de nao-participante (Comprador C) retorna 0 linhas';
  ELSE
    RAISE NOTICE 'FAIL -- caso 4b: breakdown de nao-participante retornou % linhas (esperado 0)', total;
  END IF;
END
$$;
RESET ROLE;
RESET app.comprador_id;

-- 4c: participante -> propria linha identificada, demais anonimas
SET LOCAL ROLE app_comprador;
SET LOCAL app.comprador_id = 'test_comprador_a';
DO $$
DECLARE
  linha          record;
  minha_linha_ok boolean := false;
  vazou_id_de_b  boolean := false;
  total_linhas   int := 0;
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

  IF minha_linha_ok AND NOT vazou_id_de_b AND total_linhas = 2 THEN
    RAISE NOTICE 'PASS -- caso 4c: breakdown de participante -- % linhas, propria identificada, Comprador B anonimizado', total_linhas;
  ELSE
    RAISE NOTICE 'FAIL -- caso 4c: minha_linha_ok=%, vazou_id_de_b=%, total_linhas=%', minha_linha_ok, vazou_id_de_b, total_linhas;
  END IF;
END
$$;
RESET ROLE;
RESET app.comprador_id;

-- 4d: ataque via tabela temporaria "PedidoLote" -- funcao deve continuar
-- lendo a tabela REAL (public."PedidoLote"), nao a fake da sessao do
-- atacante.
SET LOCAL ROLE app_comprador;
SET LOCAL app.comprador_id = 'test_comprador_a';
DO $$
DECLARE
  consegue_criar_temp boolean := true;
  linha                record;
  vazou_fake           boolean := false;
  minha_linha_ok       boolean := false;
  total_linhas         int := 0;
BEGIN
  BEGIN
    CREATE TEMP TABLE "PedidoLote" (
      id text, "loteId" text, "compradorId" text, "volumeM3" float8, "costShare" float8
    );
    INSERT INTO "PedidoLote" VALUES ('fake', 'test_lote_1', 'ATACANTE', 9999, 9999);
  EXCEPTION WHEN insufficient_privilege THEN
    consegue_criar_temp := false;
  END;

  IF NOT consegue_criar_temp THEN
    RAISE NOTICE 'PASS (parcial) -- caso 4d: app_comprador NAO tem privilegio de criar tabela temporaria -- ataque nem chega a ser possivel, qualificacao public. nao foi exercitada';
  ELSE
    FOR linha IN SELECT * FROM fn_breakdown_lote('test_lote_1') LOOP
      total_linhas := total_linhas + 1;
      IF linha.comprador_id = 'ATACANTE' OR linha.volume_m3 = 9999 THEN
        vazou_fake := true;
      END IF;
      IF linha.comprador_id = 'test_comprador_a' AND linha.volume_m3 = 5.0 THEN
        minha_linha_ok := true;
      END IF;
    END LOOP;

    DROP TABLE pg_temp."PedidoLote";

    IF NOT vazou_fake AND minha_linha_ok AND total_linhas = 2 THEN
      RAISE NOTICE 'PASS -- caso 4d: app_comprador criou tabela temporaria "PedidoLote", funcao continuou lendo a tabela real (public."PedidoLote")';
    ELSE
      RAISE NOTICE 'FAIL -- caso 4d: vazou_fake=%, minha_linha_ok=%, total_linhas=% (funcao pode ter lido a tabela temporaria fake)', vazou_fake, minha_linha_ok, total_linhas;
    END IF;
  END IF;
END
$$;
RESET ROLE;
RESET app.comprador_id;

-- --- Caso 5: GRANT por coluna em Avaliacao (E1) ----------------------------

SET LOCAL ROLE app_comprador;
SET LOCAL app.comprador_id = 'test_comprador_a';

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    INSERT INTO "Avaliacao" (id, "fornecedorId", "compradorId", rating, "sentimentScore")
    VALUES ('test_avaliacao_sentimento', 'test_fornecedor_1', 'test_comprador_a', 4, 0.9);
  EXCEPTION WHEN insufficient_privilege THEN
    bloqueado := true;
  END;

  IF bloqueado THEN
    RAISE NOTICE 'PASS -- caso 5a: app_comprador NAO consegue inserir sentimentScore em Avaliacao';
  ELSE
    RAISE NOTICE 'FAIL -- caso 5a: app_comprador conseguiu inserir sentimentScore (GRANT por coluna nao esta bloqueando)';
  END IF;
END
$$;

DO $$
BEGIN
  BEGIN
    INSERT INTO "Avaliacao" (id, "fornecedorId", "compradorId", rating, comment)
    VALUES ('test_avaliacao_sem_sentimento', 'test_fornecedor_1', 'test_comprador_a', 4, 'Chegou no prazo.');
    RAISE NOTICE 'PASS -- caso 5b: app_comprador consegue inserir Avaliacao sem sentimentScore';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'FAIL -- caso 5b: insercao sem sentimentScore foi bloqueada (nao deveria)';
  END;
END
$$;

RESET ROLE;
RESET app.comprador_id;

-- --- Caso 6: has_table_privilege = false nas 5 tabelas sem GRANT (E1) ------

DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY['Usuario', 'SessaoRefreshToken', 'LogAuditoria', 'Pagamento', 'Repasse'];
  pode boolean;
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('SELECT has_table_privilege(%L, %L, %L)', 'app_comprador', format('public.%I', t), 'SELECT') INTO pode;
    IF pode THEN
      RAISE NOTICE 'FAIL -- caso 6 (%): has_table_privilege retornou TRUE (app_comprador NAO deveria ter SELECT)', t;
    ELSE
      RAISE NOTICE 'PASS -- caso 6 (%): has_table_privilege(app_comprador, SELECT) = false', t;
    END IF;
  END LOOP;
END
$$;

-- --- Caso 7: CHECK papel<->perfil de Usuario (E1) --------------------------
-- Roda como postgres (CHECK constraint vale pra qualquer role, inclusive
-- superuser/owner -- nao e RLS, e uma restricao de integridade normal).

-- PL/pgSQL nao permite funcao/procedure aninhada dentro de um DO block --
-- a funcao auxiliar precisa ser top-level. Ela e DDL transacional, entao
-- some no ROLLBACK final igual aos dados de teste.
CREATE OR REPLACE FUNCTION pg_temp.fn_teste_usuario_check(
  p_desc text, p_id text, p_role text, p_comprador text, p_fornecedor text, p_deveria_aceitar boolean
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  falhou boolean := false;
BEGIN
  BEGIN
    EXECUTE format(
      'INSERT INTO "Usuario" (id, email, "passwordHash", role, "compradorId", "fornecedorId") VALUES (%L, %L, %L, %L, %L, %L)',
      p_id, p_id || '@rls-test.example.com', 'hash', p_role, p_comprador, p_fornecedor
    );
  EXCEPTION WHEN check_violation THEN
    falhou := true;
  END;

  IF falhou = (NOT p_deveria_aceitar) THEN
    RAISE NOTICE 'PASS -- caso 7 (%): %', p_desc, CASE WHEN p_deveria_aceitar THEN 'aceito como esperado' ELSE 'rejeitado pelo CHECK como esperado' END;
  ELSE
    RAISE NOTICE 'FAIL -- caso 7 (%): esperava % mas %', p_desc, CASE WHEN p_deveria_aceitar THEN 'aceitar' ELSE 'rejeitar' END, CASE WHEN falhou THEN 'rejeitou' ELSE 'aceitou' END;
  END IF;
END;
$$;

SELECT pg_temp.fn_teste_usuario_check('COMPRADOR valido', 'test_u_comprador_ok', 'COMPRADOR', 'test_comprador_a', NULL, true);
SELECT pg_temp.fn_teste_usuario_check('COMPRADOR sem compradorId', 'test_u_comprador_sem_perfil', 'COMPRADOR', NULL, NULL, false);
SELECT pg_temp.fn_teste_usuario_check('COMPRADOR com os dois perfis', 'test_u_comprador_dois_perfis', 'COMPRADOR', 'test_comprador_b', 'test_fornecedor_1', false);
SELECT pg_temp.fn_teste_usuario_check('FORNECEDOR valido', 'test_u_fornecedor_ok', 'FORNECEDOR', NULL, 'test_fornecedor_1', true);
SELECT pg_temp.fn_teste_usuario_check('FORNECEDOR sem fornecedorId', 'test_u_fornecedor_sem_perfil', 'FORNECEDOR', NULL, NULL, false);
SELECT pg_temp.fn_teste_usuario_check('ADMIN valido (sem perfil)', 'test_u_admin_ok', 'ADMIN', NULL, NULL, true);
SELECT pg_temp.fn_teste_usuario_check('ADMIN com compradorId', 'test_u_admin_com_comprador', 'ADMIN', 'test_comprador_b', NULL, false);

-- --- Caso 8: LogAuditoria -- UPDATE, DELETE e TRUNCATE bloqueados (E1) -----

INSERT INTO "LogAuditoria" (id, entidade, "entidadeId", acao, "dadosDepois", "hashAnterior", "hashAtual")
VALUES ('test_log_1', 'Teste', 't1', 'CRIAR', '{}', 'genesis', 'hash-teste-1');

DO $$
BEGIN
  BEGIN
    UPDATE "LogAuditoria" SET acao = 'ALTERADO' WHERE id = 'test_log_1';
    RAISE NOTICE 'FAIL -- caso 8a: UPDATE em LogAuditoria NAO foi bloqueado';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS -- caso 8a: UPDATE em LogAuditoria bloqueado (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM "LogAuditoria" WHERE id = 'test_log_1';
    RAISE NOTICE 'FAIL -- caso 8b: DELETE em LogAuditoria NAO foi bloqueado';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS -- caso 8b: DELETE em LogAuditoria bloqueado (%)', SQLERRM;
  END;

  BEGIN
    TRUNCATE "LogAuditoria";
    RAISE NOTICE 'FAIL -- caso 8c: TRUNCATE em LogAuditoria NAO foi bloqueado';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS -- caso 8c: TRUNCATE em LogAuditoria bloqueado (%)', SQLERRM;
  END;
END
$$;

ROLLBACK;
