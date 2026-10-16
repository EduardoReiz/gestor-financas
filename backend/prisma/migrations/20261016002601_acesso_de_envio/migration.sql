-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('DONO', 'ENVIO');

-- AlterTable
ALTER TABLE "Cobranca" ADD COLUMN     "enviadaPorId" TEXT;

-- AlterTable
ALTER TABLE "Passkey" ADD COLUMN     "papel" "Papel" NOT NULL DEFAULT 'DONO',
ADD COLUMN     "pessoa" TEXT;

-- CreateTable
CREATE TABLE "Convite" (
    "id" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "pessoa" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'ENVIO',
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Convite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Convite_codigoHash_key" ON "Convite"("codigoHash");

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_enviadaPorId_fkey" FOREIGN KEY ("enviadaPorId") REFERENCES "Passkey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
