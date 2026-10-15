-- CreateEnum
CREATE TYPE "TipoConta" AS ENUM ('CORRENTE', 'POUPANCA', 'CARTAO_CREDITO');

-- CreateEnum
CREATE TYPE "Sentido" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "OrigemCategoria" AS ENUM ('PLUGGY', 'REGRA', 'MANUAL');

-- CreateEnum
CREATE TYPE "TipoSugestao" AS ENUM ('ONDE', 'QUANDO');

-- CreateEnum
CREATE TYPE "StatusSugestao" AS ENUM ('NOVA', 'ACEITA', 'IGNORADA');

-- CreateTable
CREATE TABLE "Passkey" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "chavePublica" BYTEA NOT NULL,
    "contador" INTEGER NOT NULL DEFAULT 0,
    "aparelho" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usadaEm" TIMESTAMP(3),

    CONSTRAINT "Passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InscricaoPush" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "aparelho" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InscricaoPush_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conexao" (
    "id" TEXT NOT NULL,
    "pluggyItemId" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sincronizadaEm" TIMESTAMP(3),

    CONSTRAINT "Conexao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conta" (
    "id" TEXT NOT NULL,
    "conexaoId" TEXT NOT NULL,
    "pluggyAccountId" TEXT NOT NULL,
    "tipo" "TipoConta" NOT NULL,
    "nome" TEXT NOT NULL,
    "numeroFinal" TEXT,
    "saldo" DECIMAL(12,2) NOT NULL,
    "limite" DECIMAL(12,2),
    "diaFechamento" INTEGER,
    "diaVencimento" INTEGER,

    CONSTRAINT "Conta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fatura" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "pluggyBillId" TEXT,
    "fechamento" DATE NOT NULL,
    "vencimento" DATE NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "paga" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Fatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sentido" "Sentido" NOT NULL,
    "cor" TEXT NOT NULL,
    "pluggyCategorias" TEXT[],

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lancamento" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "pluggyTransactionId" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT NOT NULL,
    "apelido" TEXT,
    "valor" DECIMAL(12,2) NOT NULL,
    "sentido" "Sentido" NOT NULL,
    "categoriaId" TEXT,
    "origemCategoria" "OrigemCategoria",
    "categoriaConfirmada" BOOLEAN NOT NULL DEFAULT false,
    "faturaId" TEXT,
    "parcelaAtual" INTEGER,
    "parcelasTotal" INTEGER,

    CONSTRAINT "Lancamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegraCategoria" (
    "id" TEXT NOT NULL,
    "contem" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegraCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContaFixa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valorPrevisto" DECIMAL(12,2) NOT NULL,
    "diaVencimento" INTEGER NOT NULL,
    "formaPagamento" TEXT NOT NULL,
    "categoriaId" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ContaFixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContaAPagar" (
    "id" TEXT NOT NULL,
    "contaFixaId" TEXT,
    "nome" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "vencimento" DATE NOT NULL,
    "pagaEm" TIMESTAMP(3),
    "lancamentoId" TEXT,

    CONSTRAINT "ContaAPagar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meta" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valorAlvo" DECIMAL(12,2) NOT NULL,
    "prazo" DATE NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arquivada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aporte" (
    "id" TEXT NOT NULL,
    "metaId" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "data" DATE NOT NULL,

    CONSTRAINT "Aporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Limite" (
    "id" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "valorMensal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "Limite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investimento" (
    "id" TEXT NOT NULL,
    "conexaoId" TEXT NOT NULL,
    "pluggyInvestmentId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "saldo" DECIMAL(12,2) NOT NULL,
    "vencimento" DATE,

    CONSTRAINT "Investimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoInvestimento" (
    "id" TEXT NOT NULL,
    "investimentoId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "saldo" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "HistoricoInvestimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sugestao" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "tipo" "TipoSugestao" NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "impactoMensal" DECIMAL(12,2),
    "status" "StatusSugestao" NOT NULL DEFAULT 'NOVA',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sugestao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sincronizacao" (
    "id" TEXT NOT NULL,
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminadaEm" TIMESTAMP(3),
    "sucesso" BOOLEAN,
    "erro" TEXT,
    "novos" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Sincronizacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Passkey_credentialId_key" ON "Passkey"("credentialId");

-- CreateIndex
CREATE UNIQUE INDEX "InscricaoPush_endpoint_key" ON "InscricaoPush"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "Conexao_pluggyItemId_key" ON "Conexao"("pluggyItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Conta_pluggyAccountId_key" ON "Conta"("pluggyAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Fatura_pluggyBillId_key" ON "Fatura"("pluggyBillId");

-- CreateIndex
CREATE INDEX "Fatura_contaId_vencimento_idx" ON "Fatura"("contaId", "vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nome_key" ON "Categoria"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Lancamento_pluggyTransactionId_key" ON "Lancamento"("pluggyTransactionId");

-- CreateIndex
CREATE INDEX "Lancamento_data_idx" ON "Lancamento"("data");

-- CreateIndex
CREATE INDEX "Lancamento_categoriaId_data_idx" ON "Lancamento"("categoriaId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "ContaAPagar_lancamentoId_key" ON "ContaAPagar"("lancamentoId");

-- CreateIndex
CREATE INDEX "ContaAPagar_vencimento_idx" ON "ContaAPagar"("vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "ContaAPagar_contaFixaId_vencimento_key" ON "ContaAPagar"("contaFixaId", "vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "Limite_categoriaId_key" ON "Limite"("categoriaId");

-- CreateIndex
CREATE UNIQUE INDEX "Investimento_pluggyInvestmentId_key" ON "Investimento"("pluggyInvestmentId");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricoInvestimento_investimentoId_data_key" ON "HistoricoInvestimento"("investimentoId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "Sugestao_chave_key" ON "Sugestao"("chave");

-- AddForeignKey
ALTER TABLE "Conta" ADD CONSTRAINT "Conta_conexaoId_fkey" FOREIGN KEY ("conexaoId") REFERENCES "Conexao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fatura" ADD CONSTRAINT "Fatura_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_faturaId_fkey" FOREIGN KEY ("faturaId") REFERENCES "Fatura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegraCategoria" ADD CONSTRAINT "RegraCategoria_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaFixa" ADD CONSTRAINT "ContaFixa_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaAPagar" ADD CONSTRAINT "ContaAPagar_contaFixaId_fkey" FOREIGN KEY ("contaFixaId") REFERENCES "ContaFixa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaAPagar" ADD CONSTRAINT "ContaAPagar_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "Lancamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aporte" ADD CONSTRAINT "Aporte_metaId_fkey" FOREIGN KEY ("metaId") REFERENCES "Meta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Limite" ADD CONSTRAINT "Limite_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investimento" ADD CONSTRAINT "Investimento_conexaoId_fkey" FOREIGN KEY ("conexaoId") REFERENCES "Conexao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoInvestimento" ADD CONSTRAINT "HistoricoInvestimento_investimentoId_fkey" FOREIGN KEY ("investimentoId") REFERENCES "Investimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
