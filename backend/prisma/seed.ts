// Dados de EXEMPLO, os mesmos das telas desenhadas, para ver o app antes do Pluggy.
// Apaga tudo e recria. Se existir uma conexão de verdade (não "exemplo-"), recusa.
//
//   npx prisma db seed

import { PrismaClient, Sentido, TipoConta } from '@prisma/client';

const prisma = new PrismaClient();
const dia = (iso: string) => new Date(`${iso}T12:00:00`);

async function main() {
  const reais = await prisma.conexao.count({ where: { NOT: { pluggyItemId: { startsWith: 'exemplo-' } } } });
  if (reais > 0) {
    throw new Error('Há bancos reais conectados. O seed de exemplo não roda para não apagar seus dados.');
  }

  await limparTudo();

  // ---------- categorias ----------
  const cat: Record<string, string> = {};
  const categorias: [string, Sentido, string, boolean?][] = [
    ['Moradia e contas', 'SAIDA', '#1F6F4A'],
    ['Mercado', 'SAIDA', '#2E8B5E'],
    ['Delivery', 'SAIDA', '#B86E00'],
    ['Transporte', 'SAIDA', '#3D7EA6'],
    ['Lazer', 'SAIDA', '#7A5BA6'],
    ['Assinaturas', 'SAIDA', '#A64D79'],
    ['Compras online', 'SAIDA', '#5B6B64'],
    ['Outros', 'SAIDA', '#8A9690'],
    ['Renda', 'ENTRADA', '#1F6F4A'],
    ['Pagamento de fatura', 'SAIDA', '#C9D2CE', true],
  ];
  for (const [nome, sentido, cor, ignorar] of categorias) {
    const c = await prisma.categoria.create({ data: { nome, sentido, cor, ignorarNosTotais: !!ignorar } });
    cat[nome] = c.id;
  }

  // ---------- bancos e contas ----------
  const banco = async (nome: string) =>
    prisma.conexao.create({
      data: { pluggyItemId: `exemplo-${nome.toLowerCase()}`, banco: nome, status: 'UPDATED', sincronizadaEm: dia('2026-10-15') },
    });
  const [itau, bradesco, santander, sicredi] = await Promise.all(
    ['Itaú', 'Bradesco', 'Santander', 'Sicredi'].map(banco),
  );

  const conta = (conexaoId: string, nome: string, tipo: TipoConta, saldo: number, extra = {}) =>
    prisma.conta.create({
      data: { conexaoId, nome, tipo, saldo, pluggyAccountId: `exemplo-${nome}`, ...extra },
    });

  const ccItau = await conta(itau.id, 'Conta Itaú', 'CORRENTE', 1920.1);
  const ccBradesco = await conta(bradesco.id, 'Conta Bradesco', 'CORRENTE', 1402.2);
  const ccSicredi = await conta(sicredi.id, 'Conta Sicredi', 'CORRENTE', 1490.0);
  const cartaoItau = await conta(itau.id, 'Cartão Itaú', 'CARTAO_CREDITO', 0, {
    numeroFinal: '4821', limite: 3000, diaFechamento: 27, diaVencimento: 5,
  });
  const cartaoSantander = await conta(santander.id, 'Cartão Santander', 'CARTAO_CREDITO', 0, {
    numeroFinal: '0937', limite: 1500, diaFechamento: 28, diaVencimento: 10,
  });
  const cartaoBradesco = await conta(bradesco.id, 'Cartão Bradesco', 'CARTAO_CREDITO', 0, {
    numeroFinal: '5510', limite: 2000, diaFechamento: 2, diaVencimento: 12,
  });

  const fatura = (contaId: string, fechamento: string, vencimento: string, total: number) =>
    prisma.fatura.create({ data: { contaId, fechamento: dia(fechamento), vencimento: dia(vencimento), total } });
  const fatItau = await fatura(cartaoItau.id, '2026-10-27', '2026-11-05', 742.1);
  const fatSantander = await fatura(cartaoSantander.id, '2026-10-28', '2026-11-10', 611.4);
  const fatBradesco = await fatura(cartaoBradesco.id, '2026-11-02', '2026-11-12', 330.7);

  // ---------- lançamentos de outubro ----------
  type Linha = [string, string, number, string | null, string, string?, [number, number]?];
  //            data    descrição  valor  categoria     conta  fatura    parcela
  let seq = 0;
  const lancar = async (sentido: Sentido, linhas: Linha[]) => {
    for (const [data, descricao, valor, categoria, contaId, faturaId, parcela] of linhas) {
      await prisma.lancamento.create({
        data: {
          pluggyTransactionId: `exemplo-${++seq}`,
          data: dia(data),
          descricao,
          valor,
          sentido,
          contaId,
          faturaId,
          categoriaId: categoria ? cat[categoria] : null,
          origemCategoria: categoria ? 'PLUGGY' : null,
          categoriaConfirmada: categoria !== null,
          parcelaAtual: parcela?.[0],
          parcelasTotal: parcela?.[1],
        },
      });
    }
  };

  await lancar('ENTRADA', [
    ['2026-10-05', 'SALARIO', 2600, 'Renda', ccSicredi.id],
    ['2026-10-12', 'BOLSA DE ESTAGIO', 2600, 'Renda', ccSicredi.id],
  ]);

  await lancar('SAIDA', [
    // débito e Pix
    ['2026-10-03', 'ATACADAO', 264.8, 'Mercado', ccItau.id],
    ['2026-10-07', 'PAGAMENTO FATURA CARTAO', 690, 'Pagamento de fatura', ccItau.id],
    ['2026-10-08', 'SANEAGO AGUA', 68, 'Moradia e contas', ccBradesco.id],
    ['2026-10-09', 'SUPERMERCADO BRETAS', 151.2, 'Mercado', ccBradesco.id],
    ['2026-10-10', 'EQUATORIAL ENERGIA', 142.3, 'Moradia e contas', ccBradesco.id],
    ['2026-10-11', 'CINEMARK', 64, 'Lazer', ccSicredi.id],
    ['2026-10-12', 'POSTO SHELL', 150, 'Transporte', ccBradesco.id],
    ['2026-10-13', 'SUPERMERCADO BRETAS', 187.35, 'Mercado', ccBradesco.id],
    ['2026-10-13', 'PIX ENVIADO M SILVA', 60, null, ccSicredi.id],
    // cartão Itaú
    ['2026-10-01', 'SPOTIFY', 21.9, 'Assinaturas', cartaoItau.id, fatItau.id],
    ['2026-10-01', 'NETFLIX', 39.9, 'Assinaturas', cartaoItau.id, fatItau.id],
    ['2026-10-02', 'MAX', 23.9, 'Assinaturas', cartaoItau.id, fatItau.id],
    ['2026-10-04', 'AMAZON MARKETPLACE', 221.9, 'Compras online', cartaoItau.id, fatItau.id],
    ['2026-10-05', 'FONE DE OUVIDO', 49.9, 'Compras online', cartaoItau.id, fatItau.id, [3, 6]],
    ['2026-10-05', 'CURSO DE INGLES', 100, 'Outros', cartaoItau.id, fatItau.id, [2, 10]],
    ['2026-10-06', 'IFOOD', 112.4, 'Delivery', cartaoItau.id, fatItau.id],
    ['2026-10-10', 'RAPPI', 113.3, 'Delivery', cartaoItau.id, fatItau.id],
    ['2026-10-14', 'IFOOD', 58.9, 'Delivery', cartaoItau.id, fatItau.id],
    // cartão Santander
    ['2026-10-02', 'LOJAS RENNER', 325.3, 'Outros', cartaoSantander.id, fatSantander.id],
    ['2026-10-04', 'MADERO', 148, 'Lazer', cartaoSantander.id, fatSantander.id],
    ['2026-10-06', '99 CORRIDA', 18.6, 'Transporte', cartaoSantander.id, fatSantander.id],
    ['2026-10-08', 'IFOOD', 64.9, 'Delivery', cartaoSantander.id, fatSantander.id],
    ['2026-10-10', 'UBER', 31.2, 'Transporte', cartaoSantander.id, fatSantander.id],
    ['2026-10-14', 'UBER', 23.4, 'Transporte', cartaoSantander.id, fatSantander.id],
    // cartão Bradesco
    ['2026-10-05', 'DROGASIL', 87.4, 'Outros', cartaoBradesco.id, fatBradesco.id],
    ['2026-10-09', 'SHOPEE', 156.9, 'Compras online', cartaoBradesco.id, fatBradesco.id],
    ['2026-10-11', 'STEAM', 86.4, 'Lazer', cartaoBradesco.id, fatBradesco.id],
  ]);

  // ---------- meses anteriores (para o gráfico de 6 meses) ----------
  const anteriores: [string, number, number][] = [
    // mês, total de saídas, delivery
    ['2026-05', 3410, 260], ['2026-06', 3620, 310], ['2026-07', 4050, 350],
    ['2026-08', 3380, 280], ['2026-09', 3512, 298],
  ];
  for (const [mes, total, delivery] of anteriores) {
    const resto = total - delivery;
    await lancar('SAIDA', [
      [`${mes}-08`, 'CONTAS DA CASA', round(resto * 0.4), 'Moradia e contas', ccBradesco.id],
      [`${mes}-12`, 'SUPERMERCADO BRETAS', round(resto * 0.35), 'Mercado', ccBradesco.id],
      [`${mes}-18`, 'IFOOD', delivery, 'Delivery', ccItau.id],
      [`${mes}-22`, 'DIVERSOS', round(resto * 0.25), 'Outros', ccSicredi.id],
    ]);
  }

  // ---------- contas a pagar ----------
  const fixas: [string, number, number, string, string][] = [
    ['Água', 68, 8, 'débito Bradesco', 'Moradia e contas'],
    ['Energia', 142.3, 10, 'débito Bradesco', 'Moradia e contas'],
    ['Internet', 99.9, 18, 'débito Bradesco', 'Moradia e contas'],
    ['Mensalidade da faculdade', 780, 20, 'boleto', 'Outros'],
    ['Celular', 49.9, 22, 'cartão Itaú', 'Moradia e contas'],
    ['Academia', 99.9, 28, 'Pix', 'Lazer'],
  ];
  for (const [nome, valor, diaVenc, forma, categoria] of fixas) {
    const fixa = await prisma.contaFixa.create({
      data: { nome, valorPrevisto: valor, diaVencimento: diaVenc, formaPagamento: forma, categoriaId: cat[categoria] },
    });
    const vencimento = dia(`2026-10-${String(diaVenc).padStart(2, '0')}`);
    const pagoPor = diaVenc <= 10
      ? await prisma.lancamento.findFirst({ where: { valor, data: { gte: dia('2026-10-01') } } })
      : null;
    await prisma.contaAPagar.create({
      data: {
        contaFixaId: fixa.id, nome, valor, vencimento,
        pagaEm: pagoPor?.data, lancamentoId: pagoPor?.id,
      },
    });
  }

  // ---------- metas ----------
  const meta = async (nome: string, alvo: number, prazo: string, aportes: [string, number][]) =>
    prisma.meta.create({
      data: {
        nome, valorAlvo: alvo, prazo: dia(prazo),
        aportes: { create: aportes.map(([data, valor]) => ({ data: dia(data), valor })) },
      },
    });
  await meta('Reserva de emergência', 10000, '2027-12-01', [['2026-06-05', 1500], ['2026-08-05', 1400], ['2026-10-05', 300]]);
  await meta('Viagem de férias', 3000, '2027-07-01', [['2026-07-10', 850], ['2026-10-10', 50]]);
  await meta('Certificação', 1200, '2027-03-01', [['2026-09-10', 400]]);

  // ---------- investimentos ----------
  const investir = async (conexaoId: string, nome: string, tipo: string, saldo: number, saldoSetembro: number) =>
    prisma.investimento.create({
      data: {
        conexaoId, nome, tipo, saldo, pluggyInvestmentId: `exemplo-${nome}`,
        historico: { create: [{ data: dia('2026-09-30'), saldo: saldoSetembro }, { data: dia('2026-10-15'), saldo }] },
      },
    });
  await investir(itau.id, 'Tesouro Selic 2029', 'TREASURE', 3500, 3470.9);
  await investir(itau.id, 'CDB 100% do CDI', 'FIXED_INCOME', 2000, 1982.4);
  await investir(sicredi.id, 'Poupança', 'FIXED_INCOME', 930, 924.3);

  // ---------- sugestão e última sincronização ----------
  await prisma.sugestao.create({
    data: {
      chave: 'delivery-alta-2026-10',
      tipo: 'ONDE',
      titulo: 'Delivery está acima de setembro',
      texto: 'Os pedidos de delivery de outubro já passaram do total de setembro.',
      impactoMensal: 110,
    },
  });
  await prisma.sincronizacao.create({
    data: { iniciadaEm: dia('2026-10-15'), terminadaEm: new Date('2026-10-15T06:00:00'), sucesso: true, novos: 3 },
  });

  console.log('Dados de exemplo criados.');
}

function round(v: number) {
  return Math.round(v * 100) / 100;
}

async function limparTudo() {
  // ordem: filhos antes dos pais
  await prisma.contaAPagar.deleteMany();
  await prisma.contaFixa.deleteMany();
  await prisma.lancamento.deleteMany();
  await prisma.regraCategoria.deleteMany();
  await prisma.limite.deleteMany();
  await prisma.fatura.deleteMany();
  await prisma.conta.deleteMany();
  await prisma.historicoInvestimento.deleteMany();
  await prisma.investimento.deleteMany();
  await prisma.conexao.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.aporte.deleteMany();
  await prisma.meta.deleteMany();
  await prisma.sugestao.deleteMany();
  await prisma.sincronizacao.deleteMany();
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
