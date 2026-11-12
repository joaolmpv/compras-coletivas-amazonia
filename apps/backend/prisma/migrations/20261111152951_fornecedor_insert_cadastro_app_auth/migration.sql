-- Regressao introduzida pela migration anterior (20261111152103): ao
-- habilitar FORCE ROW LEVEL SECURITY em Fornecedor, o INSERT que app_auth
-- faz no cadastro (AuthService.cadastrarFornecedor) passou a ser negado --
-- RLS forcado + nenhuma politica de INSERT = nega por padrao, mesmo com o
-- GRANT INSERT existente (migration 20261029191915). Descoberto pelo
-- teste de integracao do CatalogoModule (E3), nao em producao.
--
-- Mesmo padrao exato de comprador_insert_cadastro (migration 20261029191915),
-- que resolveu o mesmo problema pra Comprador quando RLS foi habilitado la.
CREATE POLICY fornecedor_insert_cadastro ON "Fornecedor"
  FOR INSERT TO app_auth WITH CHECK (true);
