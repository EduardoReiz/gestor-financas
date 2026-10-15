import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: process.env.ORIGEM_WEB ?? 'http://localhost:5173' });

  // 127.0.0.1: em desenvolvimento a API só responde para o próprio Mac.
  // No servidor quem expõe é o Tailscale, nunca uma porta aberta no roteador.
  const porta = Number(process.env.PORTA ?? 3100);
  await app.listen(porta, '127.0.0.1');
}

void bootstrap();
