import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ResumoModule } from './resumo/resumo.module';
import { LancamentosModule } from './lancamentos/lancamentos.module';
import { CartoesModule } from './cartoes/cartoes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ResumoModule,
    LancamentosModule,
    CartoesModule,
  ],
})
export class AppModule {}
