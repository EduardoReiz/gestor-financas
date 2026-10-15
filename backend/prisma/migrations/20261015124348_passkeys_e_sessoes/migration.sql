-- AlterTable
ALTER TABLE "Passkey" ADD COLUMN     "transports" TEXT[];

-- CreateTable
CREATE TABLE "Sessao" (
    "id" TEXT NOT NULL,
    "passkeyId" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sessao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sessao_expiraEm_idx" ON "Sessao"("expiraEm");

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_passkeyId_fkey" FOREIGN KEY ("passkeyId") REFERENCES "Passkey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
