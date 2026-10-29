-- Teste de isolamento de RLS multi-ator (OE2).
--
-- Roda inteiramente dentro de UMA transacao com ROLLBACK no final -- nao deixa
-- nenhum dado de teste no banco. Assume a migration
-- 20260925152119_enable_rls_comprador_lote_pedidolote_avaliacao e as
-- migrations de roles (app_backend/app_service/app_auth/app_definer) ja
-- aplicadas.
--
-- Uso:
--   docker exec -i tcc_postgres psql -U postgres -d tcc_db -v ON_ERROR_STOP=1 \
--     < apps/backend/prisma/tests/rls-isolation.sql
--
-- Mecanismo de relatorio: cada caso grava um resultado em
-- "resultados_teste" (tabela temporaria) via pg_temp.registrar(), em vez
-- de so RAISE NOTICE -- isso deixa o script rodar TODOS os casos numa
-- execucao so (nao aborta no primeiro problema) e, no final, um DO faz
-- RAISE EXCEPTION se existir qualquer linha FAIL -- combinado com
-- `-v ON_ERROR_STOP=1`, isso faz o psql sair com codigo != 0 sempre que
-- houver falha, sem precisar de grep externo no output.
--
-- Testes de app_backend conectado DE VERDADE (nao SET ROLE a partir de
-- postgres) ficam em rls-app-backend.sql, arquivo separado -- SET ROLE
-- verifica membership contra session_user, e postgres (superuser) sempre
-- passa esse check independente de membership real, entao esse arquivo
-- usa uma conexao de verdade pra exercitar o enforcement de membership.
--
-- Casos cobertos:
--   1. Comprador A ve so as proprias linhas (Comprador, PedidoLote, Avaliacao).
--   2. Sem app.comprador_id, nenhuma linha visivel (fail-closed).
--   3. GRANT por coluna em PedidoLote (costShare bloqueado, UPDATE bloqueado).
--   4. fn_breakdown_lote: fail-closed, restrito a participante, anonimiza
--      demais participantes, resistente a ataque de tabela temporaria.
--   5. GRANT por coluna em Avaliacao (sentimentScore bloqueado).
--   6. has_table_privilege(app_comprador, SELECT) = false nas 5 tabelas protegidas.
--   7. CHECK papel<->perfil de Usuario -- todos os ramos.
--   8. LogAuditoria: UPDATE, DELETE e TRUNCATE bloqueados.
--   9. app_service preenche costShare em PedidoLote.
--  10. app_service NAO consegue UPDATE/DELETE em LogAuditoria (so INSERT).
--  11. app_definer: dono de fn_breakdown_lote (catalogo) + funcao funciona via app_comprador.
--  12. app_auth: le Usuario, NAO le PedidoLote nem Pagamento.

BEGIN;

CREATE TEMP TABLE resultados_teste (
  id SERIAL PRIMARY KEY,
  caso text NOT NULL,
  status text NOT NULL,
  detalhe text
);

-- SECURITY DEFINER de proposito: os casos chamam registrar() depois de
-- SET LOCAL ROLE pra app_comprador/app_service/app_auth, que nao tem (e
-- nao deveria ter) GRANT na tabela temporaria -- so quem criou a tabela
-- (postgres, dono da funcao) tem. Sem isso, o PROPRIO mecanismo de
-- relatorio do teste falha com "permission denied", nao o teste em si.
CREATE OR REPLACE FUNCTION pg_temp.registrar(p_caso text, p_ok boolean, p_detalhe text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO resultados_teste (caso, status, detalhe)
  VALUES (p_caso, CASE WHEN p_ok THEN 'PASS' ELSE 'FAIL' END, p_detalhe);
END;
$$;

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

  PERFORM pg_temp.registrar(
    'caso 1: Comprador A ve so as proprias linhas',
    cnt_comprador = 1 AND cnt_pedido = 1 AND cnt_avaliacao = 1 AND NOT ve_pedido_b AND NOT ve_avaliacao_b,
    format('Comprador=%s PedidoLote=%s Avaliacao=%s ve_pedido_b=%s ve_avaliacao_b=%s',
      cnt_comprador, cnt_pedido, cnt_avaliacao, ve_pedido_b, ve_avaliacao_b)
  );
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

  PERFORM pg_temp.registrar(
    'caso 2: sem app.comprador_id, fail-closed',
    cnt_comprador = 0 AND cnt_pedido = 0 AND cnt_avaliacao = 0,
    format('Comprador=%s PedidoLote=%s Avaliacao=%s', cnt_comprador, cnt_pedido, cnt_avaliacao)
  );
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
  PERFORM pg_temp.registrar('caso 3a: app_comprador NAO insere costShare', falhou_como_esperado);
END
$$;

DO $$
BEGIN
  INSERT INTO "PedidoLote" (id, "loteId", "compradorId", "volumeM3")
  VALUES ('test_pedido_coluna_ok', 'test_lote_2', 'test_comprador_a', 3.0);
  PERFORM pg_temp.registrar('caso 3b: app_comprador insere sem costShare', true);
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
  PERFORM pg_temp.registrar('caso 3c: app_comprador NAO faz UPDATE em PedidoLote', falhou_como_esperado);
END
$$;

RESET ROLE;
RESET app.comprador_id;

-- --- Caso 4: fn_breakdown_lote (E1, revisado no PR #1) ---------------------

SET LOCAL ROLE app_comprador;
DO $$
DECLARE
  total int;
BEGIN
  SELECT count(*) INTO total FROM fn_breakdown_lote('test_lote_1');
  PERFORM pg_temp.registrar('caso 4a: breakdown sem identidade -> 0 linhas', total = 0, format('retornou %s', total));
END
$$;
RESET ROLE;

SET LOCAL ROLE app_comprador;
SET LOCAL app.comprador_id = 'test_comprador_c';
DO $$
DECLARE
  total int;
BEGIN
  SELECT count(*) INTO total FROM fn_breakdown_lote('test_lote_1');
  PERFORM pg_temp.registrar('caso 4b: breakdown de nao-participante -> 0 linhas', total = 0, format('retornou %s', total));
END
$$;
RESET ROLE;
RESET app.comprador_id;

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

  PERFORM pg_temp.registrar(
    'caso 4c: breakdown de participante -- propria identificada, B anonimizado',
    minha_linha_ok AND NOT vazou_id_de_b AND total_linhas = 2,
    format('minha_linha_ok=%s vazou_id_de_b=%s total_linhas=%s', minha_linha_ok, vazou_id_de_b, total_linhas)
  );
END
$$;
RESET ROLE;
RESET app.comprador_id;

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
    PERFORM pg_temp.registrar('caso 4d: ataque de tabela temporaria', true,
      'app_comprador nao tem privilegio de criar tabela temp -- ataque nem chega a ser possivel');
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

    PERFORM pg_temp.registrar(
      'caso 4d: funcao resiste a ataque de tabela temporaria "PedidoLote"',
      NOT vazou_fake AND minha_linha_ok AND total_linhas = 2,
      format('vazou_fake=%s minha_linha_ok=%s total_linhas=%s', vazou_fake, minha_linha_ok, total_linhas)
    );
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
  PERFORM pg_temp.registrar('caso 5a: app_comprador NAO insere sentimentScore', bloqueado);
END
$$;

DO $$
DECLARE
  ok boolean := true;
BEGIN
  BEGIN
    INSERT INTO "Avaliacao" (id, "fornecedorId", "compradorId", rating, comment)
    VALUES ('test_avaliacao_sem_sentimento', 'test_fornecedor_1', 'test_comprador_a', 4, 'Chegou no prazo.');
  EXCEPTION WHEN insufficient_privilege THEN
    ok := false;
  END;
  PERFORM pg_temp.registrar('caso 5b: app_comprador insere Avaliacao sem sentimentScore', ok);
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
    PERFORM pg_temp.registrar(format('caso 6 (%s): app_comprador sem SELECT', t), NOT pode);
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

  PERFORM pg_temp.registrar(
    format('caso 7 (%s)', p_desc),
    falhou = (NOT p_deveria_aceitar),
    CASE WHEN p_deveria_aceitar THEN
      CASE WHEN falhou THEN 'esperava aceitar, rejeitou' ELSE 'aceito como esperado' END
    ELSE
      CASE WHEN falhou THEN 'rejeitado pelo CHECK como esperado' ELSE 'esperava rejeitar, aceitou' END
    END
  );
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
DECLARE
  bloqueado boolean;
BEGIN
  bloqueado := false;
  BEGIN
    UPDATE "LogAuditoria" SET acao = 'ALTERADO' WHERE id = 'test_log_1';
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM pg_temp.registrar('caso 8a: UPDATE em LogAuditoria bloqueado', bloqueado);

  bloqueado := false;
  BEGIN
    DELETE FROM "LogAuditoria" WHERE id = 'test_log_1';
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM pg_temp.registrar('caso 8b: DELETE em LogAuditoria bloqueado', bloqueado);

  bloqueado := false;
  BEGIN
    TRUNCATE "LogAuditoria";
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM pg_temp.registrar('caso 8c: TRUNCATE em LogAuditoria bloqueado', bloqueado);
END
$$;

-- --- Caso 9-10: app_service (Parte 5/6, design-backend.md 12.1.1) ----------

SET LOCAL ROLE app_service;

DO $$
DECLARE
  novo_valor float8;
BEGIN
  UPDATE "PedidoLote" SET "costShare" = 555.55 WHERE id = 'test_pedido_a';
  SELECT "costShare" INTO novo_valor FROM "PedidoLote" WHERE id = 'test_pedido_a';
  PERFORM pg_temp.registrar('caso 9: app_service preenche costShare em PedidoLote', novo_valor = 555.55,
    format('costShare ficou %s (esperado 555.55)', novo_valor));
END
$$;

DO $$
DECLARE
  bloqueado boolean;
BEGIN
  bloqueado := false;
  BEGIN
    UPDATE "LogAuditoria" SET acao = 'ALTERADO' WHERE id = 'test_log_1';
  EXCEPTION WHEN insufficient_privilege THEN
    bloqueado := true;
  END;
  PERFORM pg_temp.registrar('caso 10a: app_service NAO faz UPDATE em LogAuditoria', bloqueado);

  bloqueado := false;
  BEGIN
    DELETE FROM "LogAuditoria" WHERE id = 'test_log_1';
  EXCEPTION WHEN insufficient_privilege THEN
    bloqueado := true;
  END;
  PERFORM pg_temp.registrar('caso 10b: app_service NAO faz DELETE em LogAuditoria', bloqueado);
END
$$;

RESET ROLE;

-- --- Caso 11: app_definer (Parte 5/6) ---------------------------------------

DO $$
DECLARE
  dono          text;
  pode_login    boolean;
  pode_bypass   boolean;
  membro_backend boolean;
BEGIN
  SELECT proowner::regrole::text INTO dono FROM pg_proc WHERE proname = 'fn_breakdown_lote';
  SELECT rolcanlogin, rolbypassrls INTO pode_login, pode_bypass FROM pg_roles WHERE rolname = 'app_definer';
  SELECT pg_has_role('app_backend', 'app_definer', 'MEMBER') INTO membro_backend;

  PERFORM pg_temp.registrar(
    'caso 11a: catalogo -- app_definer dono de fn_breakdown_lote, NOLOGIN, sem BYPASSRLS, sem membership de app_backend',
    dono = 'app_definer' AND NOT pode_login AND NOT pode_bypass AND NOT membro_backend,
    format('dono=%s rolcanlogin=%s rolbypassrls=%s app_backend_e_membro=%s', dono, pode_login, pode_bypass, membro_backend)
  );
END
$$;

SET LOCAL ROLE app_comprador;
SET LOCAL app.comprador_id = 'test_comprador_a';
DO $$
DECLARE
  total int;
BEGIN
  SELECT count(*) INTO total FROM fn_breakdown_lote('test_lote_1');
  PERFORM pg_temp.registrar('caso 11b: fn_breakdown_lote funciona via app_comprador (dono agora e app_definer)', total = 2,
    format('retornou %s linhas (esperado 2)', total));
END
$$;
RESET ROLE;
RESET app.comprador_id;

-- --- Caso 12: app_auth (Parte 5/6) ------------------------------------------

SET LOCAL ROLE app_auth;

DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM "Usuario" WHERE id = 'test_u_comprador_ok';
  PERFORM pg_temp.registrar('caso 12a: app_auth le Usuario', cnt = 1, format('viu %s linha(s)', cnt));
END
$$;

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    PERFORM 1 FROM "PedidoLote" LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN
    bloqueado := true;
  END;
  PERFORM pg_temp.registrar('caso 12b: app_auth NAO le PedidoLote', bloqueado);
END
$$;

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    PERFORM 1 FROM "Pagamento" LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN
    bloqueado := true;
  END;
  PERFORM pg_temp.registrar('caso 12c: app_auth NAO le Pagamento', bloqueado);
END
$$;

RESET ROLE;

-- --- Relatorio final e verificacao ------------------------------------------

SELECT id, caso, status, detalhe FROM resultados_teste ORDER BY id;

DO $$
DECLARE
  cnt_fail int;
  lista    text;
BEGIN
  SELECT count(*), string_agg(caso, '; ') INTO cnt_fail, lista FROM resultados_teste WHERE status = 'FAIL';
  IF cnt_fail > 0 THEN
    RAISE EXCEPTION '% caso(s) FALHARAM: %', cnt_fail, lista;
  END IF;
  RAISE NOTICE 'TODOS OS % CASOS PASSARAM', (SELECT count(*) FROM resultados_teste);
END
$$;

ROLLBACK;
