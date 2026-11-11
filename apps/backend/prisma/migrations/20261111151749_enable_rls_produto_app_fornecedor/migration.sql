-- E3 (Catalogo) expos uma lacuna no modelo de identidade: ate aqui so existia
-- um role para "comprador autenticado agindo sobre os proprios dados"
-- (app_comprador + app.comprador_id). O criterio de aceite da E3 -- "fornecedor
-- so edita os proprios produtos" -- precisa da mesma garantia estrutural (RLS),
-- nao so de um `if` na camada de aplicacao. Este role e essa politica sao o
-- equivalente, para Fornecedor, do que app_comprador/app.comprador_id ja fazem
-- para Comprador (ver migration 20260925152119).
--
-- Produto nunca teve RLS habilitado (so GRANT simples). Habilitar agora exige
-- cobrir TODOS os leitores existentes com uma politica, ou RLS+FORCE bloqueia
-- tudo por padrao -- por isso a politica de SELECT abaixo e ampla (sem TO),
-- preservando a leitura publica do catalogo que app_comprador ja tinha.
--
-- Fornecedor em si (a tabela de cadastro) NAO entra em RLS nesta migration --
-- o criterio da E3 fala especificamente de Produto; editar o proprio cadastro
-- de Fornecedor nao esta no escopo da E3 (fica para quando/se for pedido).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_fornecedor') THEN
    CREATE ROLE app_fornecedor NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

GRANT app_fornecedor TO app_backend;

-- =============================================================================
-- Produto: leitura publica (catalogo), escrita restrita ao proprio fornecedor.
-- =============================================================================
ALTER TABLE "Produto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Produto" FORCE ROW LEVEL SECURITY;

-- Sem `TO`: aplica a qualquer role (app_comprador navegando o catalogo,
-- app_fornecedor vendo os proprios produtos entre outros, visitante anonimo
-- via app_comprador default). Nao ha dado sensivel em Produto que justifique
-- restringir leitura -- e um catalogo publico por natureza.
CREATE POLICY produto_select_publico ON "Produto"
  FOR SELECT
  USING (true);

CREATE POLICY produto_insert_fornecedor ON "Produto"
  FOR INSERT TO app_fornecedor
  WITH CHECK ("fornecedorId" = current_setting('app.fornecedor_id', true));

CREATE POLICY produto_update_fornecedor ON "Produto"
  FOR UPDATE TO app_fornecedor
  USING ("fornecedorId" = current_setting('app.fornecedor_id', true))
  WITH CHECK ("fornecedorId" = current_setting('app.fornecedor_id', true));

CREATE POLICY produto_delete_fornecedor ON "Produto"
  FOR DELETE TO app_fornecedor
  USING ("fornecedorId" = current_setting('app.fornecedor_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "Produto" TO app_fornecedor;

-- Prisma emite INSERT/UPDATE ... RETURNING * (ver migration 20261110145144,
-- mesmo motivo) -- app_fornecedor precisa de SELECT em Fornecedor pra resolver
-- a relacao ao criar/editar um Produto (fornecedor.findUnique de validacao) e
-- em HubLogistico porque o catalogo de hubs (GET /hubs) tambem roda, por
-- default, como o role da requisicao quando nao-autenticada -- mas HubLogistico
-- ja e SELECT-publico sem RLS, entao so falta Fornecedor aqui.
GRANT SELECT ON "Fornecedor" TO app_fornecedor;
