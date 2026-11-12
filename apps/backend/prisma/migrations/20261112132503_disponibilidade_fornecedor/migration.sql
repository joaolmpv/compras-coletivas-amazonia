-- CreateTable
CREATE TABLE "DisponibilidadeFornecedor" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "quantidadeMinima" DOUBLE PRECISION NOT NULL,
    "quantidadeMaxima" DOUBLE PRECISION NOT NULL,
    "prazoMaximoEsperaDias" INTEGER NOT NULL,
    "vigenciaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenciaFim" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisponibilidadeFornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DisponibilidadeFornecedor_produtoId_hubId_key" ON "DisponibilidadeFornecedor"("produtoId", "hubId");

-- AddForeignKey
ALTER TABLE "DisponibilidadeFornecedor" ADD CONSTRAINT "DisponibilidadeFornecedor_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisponibilidadeFornecedor" ADD CONSTRAINT "DisponibilidadeFornecedor_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisponibilidadeFornecedor" ADD CONSTRAINT "DisponibilidadeFornecedor_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "HubLogistico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- D-B (design-backend.md 13.2 / DEVELOPMENT.md E3): "minimo <= maximo
-- garantido no banco" e um criterio explicito da E3, nao so validacao Zod.
ALTER TABLE "DisponibilidadeFornecedor"
  ADD CONSTRAINT "DisponibilidadeFornecedor_min_le_max"
  CHECK ("quantidadeMinima" <= "quantidadeMaxima");

-- RLS: decisao aprovada (perguntas da secao 13.2) -- leitura RESTRITA (nao
-- publica, diferente de Produto): so o proprio fornecedor (app_fornecedor,
-- mesma variavel de sessao app.fornecedor_id ja usada em Produto/
-- Fornecedor) e app_service (job de casamento da E5, ainda nao
-- implementado -- GRANT concedido agora pra nao precisar de outra
-- migration quando a E5 chegar, igual ja se fez com app_comprador/
-- app_service em etapas anteriores que preparam GRANT antes do codigo
-- que usa).
ALTER TABLE "DisponibilidadeFornecedor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DisponibilidadeFornecedor" FORCE ROW LEVEL SECURITY;

CREATE POLICY disponibilidade_own ON "DisponibilidadeFornecedor"
  FOR ALL TO app_fornecedor
  USING ("fornecedorId" = current_setting('app.fornecedor_id', true))
  WITH CHECK ("fornecedorId" = current_setting('app.fornecedor_id', true));

CREATE POLICY disponibilidade_app_service ON "DisponibilidadeFornecedor"
  FOR SELECT TO app_service USING (true);

-- Sem politica para app_comprador/app_auth -- RLS nega por padrao (mesmo
-- fail-closed de sempre). Se um GET publico for aprovado depois, entra
-- como uma nova politica (nunca editando as duas acima).
GRANT SELECT, INSERT, UPDATE, DELETE ON "DisponibilidadeFornecedor" TO app_fornecedor;
GRANT SELECT ON "DisponibilidadeFornecedor" TO app_service;
