/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "StatusLote" AS ENUM ('ABERTO', 'FECHADO', 'DESPACHADO');

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "Comprador" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comprador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "reputationScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HubLogistico" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "fixedDispatchCost" DOUBLE PRECISION NOT NULL,
    "variableCostPerM3" DOUBLE PRECISION NOT NULL,
    "capacityM3" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "HubLogistico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lote" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "status" "StatusLote" NOT NULL DEFAULT 'ABERTO',
    "totalVolumeM3" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION,
    "dispatchDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoLote" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "compradorId" TEXT NOT NULL,
    "volumeM3" DOUBLE PRECISION NOT NULL,
    "costShare" DOUBLE PRECISION,

    CONSTRAINT "PedidoLote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avaliacao" (
    "id" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "compradorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "sentimentScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Comprador_document_key" ON "Comprador"("document");

-- CreateIndex
CREATE UNIQUE INDEX "Comprador_email_key" ON "Comprador"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Fornecedor_document_key" ON "Fornecedor"("document");

-- CreateIndex
CREATE UNIQUE INDEX "HubLogistico_name_key" ON "HubLogistico"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PedidoLote_loteId_compradorId_key" ON "PedidoLote"("loteId", "compradorId");

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "HubLogistico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoLote" ADD CONSTRAINT "PedidoLote_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoLote" ADD CONSTRAINT "PedidoLote_compradorId_fkey" FOREIGN KEY ("compradorId") REFERENCES "Comprador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_compradorId_fkey" FOREIGN KEY ("compradorId") REFERENCES "Comprador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
