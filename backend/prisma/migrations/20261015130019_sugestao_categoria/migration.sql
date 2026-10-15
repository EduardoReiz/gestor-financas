-- AlterTable
ALTER TABLE "Sugestao" ADD COLUMN     "categoriaId" TEXT;

-- AddForeignKey
ALTER TABLE "Sugestao" ADD CONSTRAINT "Sugestao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
