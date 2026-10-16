-- AlterTable
ALTER TABLE "ContaAPagar" ADD COLUMN     "valorInformado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ContaFixa" ADD COLUMN     "valorVariavel" BOOLEAN NOT NULL DEFAULT false;
