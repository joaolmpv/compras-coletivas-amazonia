-- design-backend.md secao 2.2 lista PATCH /fornecedores/me no contrato --
-- precisa da mesma garantia estrutural que Comprador ja tem (comprador_self/
-- comprador_self_update, migration 20260925152119): um fornecedor so pode
-- atualizar o proprio cadastro, via RLS, nao so por um `if` na aplicacao.
--
-- Diferente de Comprador, aqui a politica de SELECT pode ser unica e ampla
-- (sem TO): GET /fornecedores e publico (catalogo), entao nao ha necessidade
-- de uma politica "self" restritiva pra leitura -- so a escrita (UPDATE)
-- precisa ser restrita ao proprio fornecedor. Isso tambem cobre, de
-- graca, a leitura que app_auth precisa fazer no RETURNING do cadastro
-- (migration 20261110145144 fez isso num carve-out proprio pra Comprador
-- porque la a politica de SELECT ja existente era restritiva; aqui a
-- politica de SELECT nunca foi restritiva pra comecar, entao nao ha
-- carve-out a fazer).

ALTER TABLE "Fornecedor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Fornecedor" FORCE ROW LEVEL SECURITY;

CREATE POLICY fornecedor_select_publico ON "Fornecedor"
  FOR SELECT
  USING (true);

CREATE POLICY fornecedor_self_update ON "Fornecedor"
  FOR UPDATE TO app_fornecedor
  USING (id = current_setting('app.fornecedor_id', true))
  WITH CHECK (id = current_setting('app.fornecedor_id', true));

GRANT UPDATE ON "Fornecedor" TO app_fornecedor;
