-- AlterEnum
ALTER TYPE "OrigemCategoria" ADD VALUE 'CONTA_FIXA';

-- AlterTable
ALTER TABLE "Conta" ADD COLUMN     "limiteDisponivel" DECIMAL(12,2),
ADD COLUMN     "usado" DECIMAL(12,2);
