-- Revisao da E3/D-B apos auditoria de 3 pontos em DisponibilidadeFornecedor.
-- Tabela vazia (0 linhas) -- sem risco de dado real em nenhuma das
-- operacoes abaixo (rename, drop de constraint, nova FK).

-- =============================================================================
-- 1) Unidade da quantidade nao estava explicita -- renomeada pra bater com
-- o resto do schema (volumeM3, totalVolumeM3, capacityM3, variableCostPerM3),
-- direto comparavel ao volume do rateio (PedidoLote.volumeM3) sem fator de
-- conversao. RENAME COLUMN preserva o CHECK existente automaticamente --
-- Postgres rastreia a dependencia por atnum, nao por texto do nome.
-- =============================================================================
ALTER TABLE "DisponibilidadeFornecedor" RENAME COLUMN "quantidadeMinima" TO "quantidadeMinimaM3";
ALTER TABLE "DisponibilidadeFornecedor" RENAME COLUMN "quantidadeMaxima" TO "quantidadeMaximaM3";

-- =============================================================================
-- 2) FK composta nao existia -- fornecedorId era denormalizado de
-- produto.fornecedorId SO por convencao de aplicacao (ProdutosService-
-- style check em DisponibilidadesService.criar), sem garantia estrutural.
-- Precisa de um UNIQUE em Produto(id, fornecedorId) pra poder ser
-- referenciado por uma FK composta -- redundante com "id" sozinho de
-- proposito (e exatamente o alvo que faltava).
-- =============================================================================
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_id_fornecedorId_key" UNIQUE ("id", "fornecedorId");

ALTER TABLE "DisponibilidadeFornecedor"
  ADD CONSTRAINT "DisponibilidadeFornecedor_produto_fornecedor_fkey"
  FOREIGN KEY ("produtoId", "fornecedorId") REFERENCES "Produto"("id", "fornecedorId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
-- As FKs simples (produtoId -> Produto.id, fornecedorId -> Fornecedor.id,
-- migration 20261112132503) continuam -- esta e ADICIONAL, nao substitui
-- nenhuma. A partir de agora, um INSERT/UPDATE com fornecedorId que nao
-- seja o dono real de produtoId falha no banco (violacao de FK), nao so
-- na aplicacao.

-- =============================================================================
-- 3) @@unique([produtoId, hubId]) impedia reabrir uma disponibilidade
-- depois de encerrar a vigencia anterior (precisaria reusar a mesma
-- linha ou travar pra sempre). Troca por indice unico PARCIAL -- so uma
-- linha VIGENTE (vigenciaFim IS NULL) por produto x hub, historico
-- (linhas com vigenciaFim preenchido) preservado sem limite. Nao
-- expressavel no schema do Prisma (sem suporte a indice parcial) -- vive
-- so aqui.
-- =============================================================================
DROP INDEX "DisponibilidadeFornecedor_produtoId_hubId_key";

CREATE UNIQUE INDEX "DisponibilidadeFornecedor_produtoId_hubId_vigente_key"
  ON "DisponibilidadeFornecedor" ("produtoId", "hubId")
  WHERE "vigenciaFim" IS NULL;

CREATE INDEX "DisponibilidadeFornecedor_produtoId_hubId_idx"
  ON "DisponibilidadeFornecedor" ("produtoId", "hubId");

-- =============================================================================
-- 4) GRANT DELETE pra app_fornecedor existia (migration 20261112132503) --
-- errado dado o ponto 3: apagar de verdade destruiria o historico que o
-- indice parcial foi desenhado pra preservar. "Remover" uma disponibilidade
-- passa a significar SO "encerrar a vigencia" (UPDATE vigenciaFim = now()),
-- que ja e permitido (GRANT UPDATE continua). O service/controller
-- correspondentes (remover()/DELETE /disponibilidades/:id) sao removidos
-- na mesma etapa, nao ficam como codigo morto.
-- =============================================================================
REVOKE DELETE ON "DisponibilidadeFornecedor" FROM app_fornecedor;
