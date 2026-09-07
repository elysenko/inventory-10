import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  // The SPA is served by nginx, which proxies /api/ here; permissive CORS keeps the
  // API reachable when the two are deployed on different hosts.
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Unprefixed liveness probe, registered on the raw Express stack so orchestration
  // probes hitting /health (rather than /api/health) still succeed.
  app.use('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips unknown properties — blocks role/totalQty escalation
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('StockRoom API')
    .setDescription('Multi-location inventory: items, locations, movements and reports')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');
  logger.log(`StockRoom API listening on 0.0.0.0:${port} (routes under /api)`);
}

void bootstrap();
