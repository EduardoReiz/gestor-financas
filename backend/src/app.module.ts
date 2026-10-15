import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ResumoModule } from './resumo/resumo.module';
import { LancamentosModule } from './lancamentos/lancamentos.module';
import { CartoesModule } from './cartoes/cartoes.module';
import { ContasModule } from './contas/contas.module';
import { MetasModule } from './metas/metas.module';
import { InvestimentosModule } from './investimentos/investimentos.module';
import { SugestoesModule } from './sugestoes/sugestoes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ResumoModule,
    LancamentosModule,
    CartoesModule,
    ContasModule,
    MetasModule,
    InvestimentosModule,
    SugestoesModule,
  ],
})
export class AppModule {}
