-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('COMPRADOR', 'FORNECEDOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PENDENTE', 'RETIDO', 'LIBERADO', 'REEMBOLSADO', 'EXPIRADO');

-- CreateEnum
CREATE TYPE "StatusRepasse" AS ENUM ('AGUARDANDO', 'LIBERADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatusLote" ADD VALUE 'ENTREGUE';
ALTER TYPE "StatusLote" ADD VALUE 'CANCELADO';

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "PapelUsuario" NOT NULL,
    "compradorId" TEXT,
    "fornecedorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessaoRefreshToken" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "familiaId" TEXT NOT NULL,
    "hashToken" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessaoRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" TEXT NOT NULL,
    "pedidoLoteId" TEXT NOT NULL,
    "status" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE',
    "valor" DOUBLE PRECISION NOT NULL,
    "gatewayRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repasse" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "status" "StatusRepasse" NOT NULL DEFAULT 'AGUARDANDO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Repasse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "atorId" TEXT,
    "versaoAlgoritmo" TEXT,
    "hashEntrada" TEXT,
    "dadosDepois" JSONB NOT NULL,
    "hashAnterior" TEXT NOT NULL,
    "hashAtual" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_compradorId_key" ON "Usuario"("compradorId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_fornecedorId_key" ON "Usuario"("fornecedorId");

-- CreateIndex
CREATE UNIQUE INDEX "SessaoRefreshToken_hashToken_key" ON "SessaoRefreshToken"("hashToken");

-- CreateIndex
CREATE INDEX "SessaoRefreshToken_familiaId_idx" ON "SessaoRefreshToken"("familiaId");

-- CreateIndex
CREATE INDEX "SessaoRefreshToken_expiresAt_idx" ON "SessaoRefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Pagamento_pedidoLoteId_key" ON "Pagamento"("pedidoLoteId");

-- CreateIndex
CREATE UNIQUE INDEX "Repasse_loteId_key" ON "Repasse"("loteId");

-- CreateIndex
CREATE UNIQUE INDEX "LogAuditoria_hashAtual_key" ON "LogAuditoria"("hashAtual");

-- CreateIndex
CREATE INDEX "LogAuditoria_entidade_entidadeId_idx" ON "LogAuditoria"("entidade", "entidadeId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_compradorId_fkey" FOREIGN KEY ("compradorId") REFERENCES "Comprador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoRefreshToken" ADD CONSTRAINT "SessaoRefreshToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_pedidoLoteId_fkey" FOREIGN KEY ("pedidoLoteId") REFERENCES "PedidoLote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repasse" ADD CONSTRAINT "Repasse_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repasse" ADD CONSTRAINT "Repasse_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
