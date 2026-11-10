-- Correcao: o .create() do Prisma emite INSERT ... RETURNING * -- mesmo so
-- fazendo INSERT, ler as colunas de volta exige SELECT. app_auth tinha
-- INSERT em Comprador/Fornecedor (migration de E1/app_auth), mas nenhum
-- SELECT -- cadastro de comprador/fornecedor falhava com "permission
-- denied for table Comprador" no RETURNING implicito. Descoberto pelo
-- teste de integracao do AuthModule (E2), nao em producao.
GRANT SELECT ON "Fornecedor" TO app_auth;
GRANT SELECT ON "Comprador" TO app_auth;

-- Comprador tem FORCE ROW LEVEL SECURITY; a unica politica de SELECT ali
-- (comprador_self) exige app.comprador_id = id da linha -- que nunca esta
-- setado durante o cadastro (o comprador ainda nem fez login). app_auth
-- precisa de uma politica propria pra conseguir ler de volta a linha que
-- ELE MESMO acabou de inserir -- RLS nao distingue "so a linha desta
-- mesma instrucao", entao a politica e ampla (USING true), mas app_auth
-- so e usado pelas operacoes internas do AuthModule (cadastro/login/
-- refresh/logout), nunca exposto a uma query livre vinda de fora.
CREATE POLICY comprador_select_app_auth ON "Comprador"
  FOR SELECT TO app_auth USING (true);
