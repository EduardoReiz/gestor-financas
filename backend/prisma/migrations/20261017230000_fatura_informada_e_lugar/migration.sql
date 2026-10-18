-- AlterTable
ALTER TABLE "Fatura" ADD COLUMN     "informadoEm" TIMESTAMP(3),
ADD COLUMN     "totalInformado" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Lancamento" ADD COLUMN     "cartaoFinal" TEXT,
ADD COLUMN     "mcc" INTEGER;
