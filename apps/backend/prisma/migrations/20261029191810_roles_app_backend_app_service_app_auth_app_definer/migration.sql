-- Parte 5 (modelo de roles e conexao, design-backend.md secao 12).
--
-- Cria os 4 roles novos e a cadeia de membership que faz o objetivo
-- funcionar: "o backend nunca conecta como postgres em runtime, e
-- esquecer o SET ROLE deve falhar (fail-closed)".
--
-- app_backend e a UNICA coisa que o DATABASE_URL de runtime vai usar.
-- NOINHERIT nao estava no enunciado original, mas e o que faz o objetivo
-- funcionar: sem ele, ser membro de app_comprador/app_service/app_auth ja
-- concederia os privilegios automaticamente, sem precisar de SET ROLE --
-- exatamente o oposto do que foi pedido.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_backend') THEN
    CREATE ROLE app_backend LOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    CREATE ROLE app_service NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_auth') THEN
    CREATE ROLE app_auth NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_definer') THEN
    CREATE ROLE app_definer NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

-- app_backend precisa ser MEMBRO de app_comprador/app_service/app_auth
-- (nao o contrario) para conseguir SET ROLE em qualquer um dos tres.
-- Nao concede app_definer a app_backend -- ninguem precisa SET ROLE
-- app_definer diretamente, fn_breakdown_lote roda como app_definer
-- internamente (SECURITY DEFINER) quando app_comprador a executa.
GRANT app_comprador TO app_backend;
GRANT app_service TO app_backend;
GRANT app_auth TO app_backend;

-- Sem PASSWORD aqui de proposito -- ver apps/backend/scripts/provision-roles.sh.
-- Sem senha definida, app_backend nao consegue autenticar (LOGIN exige
-- password), entao localmente este role so fica realmente usavel para
-- LOGIN depois do script rodar; SET ROLE a partir de postgres (usado nos
-- testes) nao depende de senha.
