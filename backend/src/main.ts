import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: process.env.ORIGEM_WEB ?? 'http://localhost:5173' });

  // No servidor o mesmo processo entrega o site (o build do web) e a API.
  // No Mac, em desenvolvimento, quem entrega o site é o Vite.
  const site = process.env.PASTA_WEB ?? join(__dirname, '..', '..', 'web', 'dist');
  if (existsSync(site)) {
    app.useStaticAssets(site, { index: false, maxAge: '1h' });
    // qualquer rota que não seja /api é uma tela do app: devolve o index.html
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(join(site, 'index.html'));
    });
  }

  // 127.0.0.1: só a própria máquina chega na API. No servidor, quem expõe
  // é o Tailscale (tailscale serve), nunca uma porta aberta no roteador.
  const porta = Number(process.env.PORTA ?? 3100);
  await app.listen(porta, process.env.ESCUTAR_EM ?? '127.0.0.1');
}

void bootstrap();
