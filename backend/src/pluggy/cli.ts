// Sincroniza pelo terminal: npm run pluggy:sincronizar
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { PluggyModule } from './pluggy.module';
import { SincronizacaoService } from './sincronizacao.service';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, PluggyModule] })
class CliModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(CliModule, { logger: ['log', 'error', 'warn'] });
  try {
    console.log(await app.get(SincronizacaoService).sincronizar());
  } finally {
    await app.close();
  }
}

main().catch(() => (process.exitCode = 1));
