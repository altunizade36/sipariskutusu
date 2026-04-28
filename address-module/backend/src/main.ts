import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { PerformanceModule } from './modules/performance/performance.module';

@Module({
  imports: [PerformanceModule],
})
class AppModule {}

function parseTrustedOrigins(): string[] | boolean {
  const rawOrigins = process.env.CORS_ALLOWED_ORIGINS?.trim();
  if (!rawOrigins || rawOrigins === '*') {
    return true;
  }

  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function applySecurityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
}

function attachRequestId(req: Request, res: Response, next: NextFunction) {
  const incomingRequestId = req.header('x-request-id')?.trim();
  const requestId = incomingRequestId && incomingRequestId.length > 0 ? incomingRequestId : crypto.randomUUID();

  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const expressApp = app.getHttpAdapter().getInstance();
  const bodyLimit = process.env.HTTP_BODY_LIMIT ?? '1mb';
  const trustedOrigins = parseTrustedOrigins();
  const port = Number(process.env.PORT ?? 4100);

  app.enableShutdownHooks();
  expressApp.disable('x-powered-by');
  expressApp.set('trust proxy', process.env.HTTP_TRUST_PROXY ?? 1);
  expressApp.use(attachRequestId);
  expressApp.use(applySecurityHeaders);

  app.enableCors({
    origin: trustedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id', 'X-Client-Version'],
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: Number(process.env.CORS_MAX_AGE_SECONDS ?? 600),
  });

  expressApp.use(json({ limit: bodyLimit }));
  expressApp.use(urlencoded({ extended: true, limit: bodyLimit }));

  await app.listen(port);
}

void bootstrap();
