-- CreateEnum
CREATE TYPE "TipoCobranca" AS ENUM ('PIX', 'BOLETO', 'CONCESSIONARIA');

-- CreateTable
CREATE TABLE "Cobranca" (
    "id" TEXT NOT NULL,
    "tipo" "TipoCobranca" NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT,
    "valor" DECIMAL(12,2),
    "vencimento" DATE,
    "recebedor" TEXT,
    "contaFixaId" TEXT,
    "contaAPagarId" TEXT,
    "pagaEm" TIMESTAMP(3),
    "lancamentoId" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cobranca_codigo_key" ON "Cobranca"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Cobranca_contaAPagarId_key" ON "Cobranca"("contaAPagarId");

-- CreateIndex
CREATE UNIQUE INDEX "Cobranca_lancamentoId_key" ON "Cobranca"("lancamentoId");

-- CreateIndex
CREATE INDEX "Cobranca_pagaEm_idx" ON "Cobranca"("pagaEm");

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_contaFixaId_fkey" FOREIGN KEY ("contaFixaId") REFERENCES "ContaFixa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_contaAPagarId_fkey" FOREIGN KEY ("contaAPagarId") REFERENCES "ContaAPagar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "Lancamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
