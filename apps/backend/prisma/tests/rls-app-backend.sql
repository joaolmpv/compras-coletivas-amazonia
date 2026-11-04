-- Teste de conexao REAL como app_backend (nao SET ROLE a partir de postgres).
--
-- Por que uma conexao de verdade, e nao so SET LOCAL ROLE app_backend a
-- partir do script principal (rls-isolation.sql, que roda como postgres):
-- SET ROLE verifica membership contra SESSION_USER, nao CURRENT_USER.
-- postgres e superuser, e superuser sempre pode SET ROLE pra qualquer
-- coisa, independente de membership real -- mesmo depois de ja ter feito
-- SET ROLE pra outra coisa antes. So uma conexao autenticada de verdade
-- como app_backend (session_user = app_backend, nao superuser) exercita o
-- checking de membership de verdade -- em particular, o caso "app_backend
-- NAO consegue SET ROLE app_definer" so prova algo rodando aqui.
--
-- Pre-requisito: apps/backend/scripts/provision-roles.sh ja rodado
-- (senha de app_backend definida -- ver APP_BACKEND_PASSWORD).
--
-- Sem BEGIN/ROLLBACK -- nao escreve nada (nenhum dos tres roles que
-- app_backend pode virar tem INSERT nas tabelas usadas aqui), entao nao ha
-- nada pra desfazer. RAISE EXCEPTION aborta direto (sem tabela de
-- resultados compartilhada com rls-isolation.sql -- tabelas temporarias
-- sao por sessao, e esta e uma sessao/conexao diferente).
--
-- Uso: ver apps/backend/scripts/test-rls.sh

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    PERFORM 1 FROM "PedidoLote" LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN
    bloqueado := true;
  END;
  IF bloqueado THEN
    RAISE NOTICE 'PASS -- app_backend sem SET ROLE: SELECT em PedidoLote bloqueado (permission denied)';
  ELSE
    RAISE EXCEPTION 'FAIL -- app_backend sem SET ROLE conseguiu SELECT em PedidoLote (NOINHERIT nao esta funcionando)';
  END IF;
END
$$;

DO $$
DECLARE
  membro_comprador boolean;
  membro_service   boolean;
  membro_auth      boolean;
  membro_definer   boolean;
BEGIN
  membro_comprador := pg_has_role('app_backend', 'app_comprador', 'MEMBER');
  membro_service   := pg_has_role('app_backend', 'app_service', 'MEMBER');
  membro_auth      := pg_has_role('app_backend', 'app_auth', 'MEMBER');
  membro_definer   := pg_has_role('app_backend', 'app_definer', 'MEMBER');

  IF membro_comprador AND membro_service AND membro_auth AND NOT membro_definer THEN
    RAISE NOTICE 'PASS -- app_backend e membro de app_comprador/app_service/app_auth, e NAO de app_definer';
  ELSE
    RAISE EXCEPTION 'FAIL -- grafo de membership inesperado (comprador=%, service=%, auth=%, definer=%)',
      membro_comprador, membro_service, membro_auth, membro_definer;
  END IF;
END
$$;

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    EXECUTE 'SET ROLE app_definer';
  EXCEPTION WHEN insufficient_privilege THEN
    bloqueado := true;
  END;
  IF bloqueado THEN
    RAISE NOTICE 'PASS -- app_backend NAO consegue SET ROLE app_definer (enforcement real de membership, nao bypass de superuser)';
  ELSE
    RAISE EXCEPTION 'FAIL -- app_backend conseguiu SET ROLE app_definer (nao deveria ser membro)';
  END IF;
END
$$;

SET ROLE app_comprador;

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    PERFORM 1 FROM "PedidoLote" LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN
    bloqueado := true;
  END;
  IF NOT bloqueado THEN
    RAISE NOTICE 'PASS -- depois de SET ROLE app_comprador, SELECT em PedidoLote nao da permission denied (RLS passa a valer no lugar do bloqueio de privilegio)';
  ELSE
    RAISE EXCEPTION 'FAIL -- SET ROLE app_comprador nao desbloqueou SELECT em PedidoLote';
  END IF;
END
$$;

RESET ROLE;

SELECT 'rls-app-backend.sql: todos os casos passaram' AS resultado;
