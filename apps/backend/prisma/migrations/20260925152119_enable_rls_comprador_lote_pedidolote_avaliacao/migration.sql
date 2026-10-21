-- Row Level Security multi-ator (OE2).
--
-- Prisma nao expressa RLS no schema.prisma, entao esta migration e SQL puro,
-- escrita a mao sobre o esqueleto gerado por `prisma migrate dev --create-only`.
--
-- Modelo de identidade: a aplicacao roda como um role sem privilegio elevado
-- (ver CREATE ROLE abaixo) e, a cada request autenticado, seta uma variavel de
-- sessao com o id do Comprador logado:
--
--   SET LOCAL app.comprador_id = '<id do comprador do JWT>';
--
-- As politicas abaixo comparam as linhas contra `current_setting('app.comprador_id', true)`
-- (o `true` faz retornar NULL em vez de erro quando a variavel nao foi setada --
-- nesse caso nenhuma linha bate, ou seja, "sem identidade = sem acesso", fail-closed).
--
-- ATENCAO -- superuser bypassa RLS sempre: a conexao do Prisma hoje
-- (`DATABASE_URL` em apps/backend/.env) usa o role `postgres`, que e superuser
-- e portanto NAO fica sujeito a nenhuma das politicas abaixo, mesmo com
-- FORCE ROW LEVEL SECURITY. Para as politicas realmente valerem, o backend
-- NestJS (ainda nao implementado) precisa, por request autenticado, rodar
-- `SET LOCAL ROLE app_comprador;` + `SET LOCAL app.comprador_id = '...';`
-- dentro da mesma transacao antes de qualquer query -- isso fica documentado
-- aqui como pendencia para quando os endpoints forem escritos.
--
-- PENDENCIAS conhecidas, a resolver nas proximas etapas (nao bloqueiam esta
-- migration, mas limitam o que app_comprador consegue fazer hoje):
-- (a) GET /lotes/:id/breakdown (auditoria do OE3) precisa do rateio de TODOS
--     os participantes do lote, nao so do comprador logado -- isso exige uma
--     funcao SECURITY DEFINER (que roda com os privilegios de quem a criou,
--     ignorando RLS do chamador) retornando uma versao anonimizada do
--     breakdown, ou uma chamada por um role de servico com BYPASSRLS. Ainda
--     nao implementado.
-- (b) PedidoLote: a politica pedidolote_own_insert abaixo so restringe POR
--     LINHA (o comprador so insere com compradorId = o proprio id), mas nao
--     restringe POR COLUNA -- hoje nada impede que o comprador, inserindo via
--     app_comprador, defina ele mesmo costShare/volumeM3 arbitrarios. O
--     rateio real e calculado no fechamento do lote; o INSERT de adesao
--     deveria aceitar so volumeM3 (a declaracao de interesse) e nunca
--     costShare (que so o backend, no fechamento, deve preencher). Prisma/SQL
--     puro nao tem GRANT column-level fácil de combinar com RLS aqui sem uma
--     view ou funcao dedicada -- ver NestJS (service layer) como o lugar mais
--     simples de aplicar essa restricao por enquanto, com column-level GRANT
--     ou uma view de insercao como melhoria futura.

-- Role de aplicacao, sem LOGIN proprio (o Prisma continua conectando como
-- `postgres`; o backend troca de identidade em runtime via `SET LOCAL ROLE`,
-- que so e permitido porque `postgres` e concedido como membro abaixo).
-- Bloco DO + checagem em pg_roles para ser idempotente: o shadow database que
-- `prisma migrate dev` cria e descarta a cada rodada reaplica todas as
-- migrations do zero, e um CREATE ROLE sem guarda falharia na segunda vez
-- (role e global ao cluster Postgres, nao por schema/database).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_comprador') THEN
    CREATE ROLE app_comprador NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

GRANT app_comprador TO postgres;

-- Catalogo publico (sem RLS nesta etapa): um comprador precisa navegar por
-- fornecedores, produtos e hubs antes de aderir a um lote.
GRANT SELECT ON "Fornecedor", "Produto", "HubLogistico" TO app_comprador;

-- Lote fica de leitura publica para compradores autenticados (e o "catalogo"
-- de lotes abertos para adesao); escrita (criar/fechar/despachar lote) e
-- responsabilidade do backend/fila de otimizacao, nao do comprador
-- diretamente -- por isso so ha GRANT de SELECT aqui.
GRANT SELECT ON "Lote" TO app_comprador;

GRANT SELECT, UPDATE ON "Comprador" TO app_comprador;
GRANT SELECT, INSERT ON "PedidoLote" TO app_comprador;
GRANT SELECT, INSERT ON "Avaliacao" TO app_comprador;

-- =============================================================================
-- Comprador: cada comprador só enxerga (e só pode atualizar) o próprio
-- cadastro. Cadastro (INSERT) fica fora desta política — precisa rodar por um
-- role de cadastro/admin com BYPASSRLS, já que no momento do INSERT ainda não
-- existe um app.comprador_id de sessão para o novo comprador.
-- =============================================================================
ALTER TABLE "Comprador" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Comprador" FORCE ROW LEVEL SECURITY;

CREATE POLICY comprador_self ON "Comprador"
  FOR SELECT
  USING (id = current_setting('app.comprador_id', true));

CREATE POLICY comprador_self_update ON "Comprador"
  FOR UPDATE
  USING (id = current_setting('app.comprador_id', true))
  WITH CHECK (id = current_setting('app.comprador_id', true));

-- =============================================================================
-- Lote: não pertence a um único comprador (é o agrupamento compartilhado em
-- si), então a política de leitura é "qualquer comprador autenticado pode ver
-- qualquer lote" (precisa navegar o catálogo de lotes abertos para decidir se
-- adere). RLS é ativado mesmo assim, junto com FORCE, para (a) manter a
-- superfície de tabelas protegidas alinhada ao pedido original e (b) porque
-- sem nenhuma política, RLS habilitado bloquearia TODAS as linhas por padrão
-- -- a política abaixo é o que evita isso.
-- =============================================================================
ALTER TABLE "Lote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lote" FORCE ROW LEVEL SECURITY;

CREATE POLICY lote_select_authenticated ON "Lote"
  FOR SELECT
  USING (NULLIF(current_setting('app.comprador_id', true), '') IS NOT NULL);

-- =============================================================================
-- PedidoLote: um comprador só vê (e só pode criar) os próprios pedidos de
-- adesão a lote -- é a tabela de rateio (costShare), então vazamento aqui
-- exporia quanto outro comprador está pagando.
-- =============================================================================
ALTER TABLE "PedidoLote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PedidoLote" FORCE ROW LEVEL SECURITY;

CREATE POLICY pedidolote_own ON "PedidoLote"
  FOR SELECT
  USING ("compradorId" = current_setting('app.comprador_id', true));

CREATE POLICY pedidolote_own_insert ON "PedidoLote"
  FOR INSERT
  WITH CHECK ("compradorId" = current_setting('app.comprador_id', true));

-- =============================================================================
-- Avaliacao: um comprador só vê (e só pode criar) as próprias avaliações.
--
-- Atrito conhecido com o OE4: o índice de reputação do Fornecedor precisa
-- agregar avaliações de TODOS os compradores, o que esta política impede para
-- o role app_comprador por design. Esse cálculo deve rodar por um role
-- privilegiado (o próprio `postgres`, ou um `app_service` com BYPASSRLS a ser
-- criado quando o módulo OE4 for implementado) -- não por app_comprador.
-- =============================================================================
ALTER TABLE "Avaliacao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Avaliacao" FORCE ROW LEVEL SECURITY;

CREATE POLICY avaliacao_own ON "Avaliacao"
  FOR SELECT
  USING ("compradorId" = current_setting('app.comprador_id', true));

CREATE POLICY avaliacao_own_insert ON "Avaliacao"
  FOR INSERT
  WITH CHECK ("compradorId" = current_setting('app.comprador_id', true));
