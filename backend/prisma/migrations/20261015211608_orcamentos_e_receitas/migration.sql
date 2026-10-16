-- DropForeignKey
ALTER TABLE "Limite" DROP CONSTRAINT "Limite_categoriaId_fkey";

-- DropIndex
DROP INDEX "Limite_categoriaId_key";

-- AlterTable
ALTER TABLE "Limite" DROP COLUMN "categoriaId",
ADD COLUMN     "nome" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Receita" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "dia" INTEGER,
    "contem" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CategoriaToLimite" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoriaToLimite_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CategoriaToLimite_B_index" ON "_CategoriaToLimite"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Limite_nome_key" ON "Limite"("nome");

-- AddForeignKey
ALTER TABLE "_CategoriaToLimite" ADD CONSTRAINT "_CategoriaToLimite_A_fkey" FOREIGN KEY ("A") REFERENCES "Categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoriaToLimite" ADD CONSTRAINT "_CategoriaToLimite_B_fkey" FOREIGN KEY ("B") REFERENCES "Limite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

