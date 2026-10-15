import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ResumoModule } from './resumo/resumo.module';
import { LancamentosModule } from './lancamentos/lancamentos.module';
import { CartoesModule } from './cartoes/cartoes.module';
import { ContasModule } from './contas/contas.module';
import { MetasModule } from './metas/metas.module';
import { InvestimentosModule } from './investimentos/investimentos.module';
import { SugestoesModule } from './sugestoes/sugestoes.module';
import { PluggyModule } from './pluggy/pluggy.module';
import { CobrancasModule } from './cobrancas/cobrancas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    ResumoModule,
    LancamentosModule,
    CartoesModule,
    ContasModule,
    MetasModule,
    InvestimentosModule,
    SugestoesModule,
    PluggyModule,
    CobrancasModule,
  ],
})
export class AppModule {}
