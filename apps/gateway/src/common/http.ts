import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { createRequestId, resolveCorrelationId } from '@amani/shared';
import { json } from 'express';
import type { Express, NextFunction, Response } from 'express';
import type { GatewayRequest } from './context';
import { errorBody, SafeExceptionFilter } from './errors';
import { SafeLogger } from './logging';
import { RateLimiter } from './rate-limit';
import { GATEWAY_CONFIG } from '../config/gateway.config';
import type { GatewayConfig } from '../config/gateway.config';

export const RESERVED_HEADERS = [
  'x-user-id',
  'x-organization-id',
  'x-roles',
  'x-permissions',
  'x-internal-service',
  'x-service-name',
  'x-calling-service',
  'x-actor-id',
  'x-authenticated-user',
  'x-amani-development-context',
  'x-amani-development-signature',
  'forwarded',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
] as const;
export function configureHttp(app: INestApplication) {
  const config = app.get<GatewayConfig>(GATEWAY_CONFIG);
  const logger = app.get(SafeLogger);
  const limiter = app.get(RateLimiter);
  const express = app.getHttpAdapter().getInstance() as Express;
  express.disable('x-powered-by');
  express.set('trust proxy', false);
  const parser = json({
    limit: config.bodyLimitBytes,
    strict: true,
    inflate: false,
  });
  app.use((req: GatewayRequest, res: Response, next: NextFunction) => {
    const started = Date.now();
    req.context = {
      service: '@amani/gateway',
      requestId: createRequestId(),
      correlationId: resolveCorrelationId(req.headers['x-correlation-id']),
      timestamp: new Date().toISOString(),
      apiVersion: '1',
    };
    res.setHeader('x-request-id', req.context.requestId);
    res.setHeader('x-correlation-id', req.context.correlationId);
    for (const key of RESERVED_HEADERS) delete req.headers[key];
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('cache-control', 'no-store');
    res.setHeader(
      'content-security-policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
    if (config.production)
      res.setHeader('strict-transport-security', 'max-age=31536000');
    res.on('finish', () => {
      const route: unknown = (req.route as { path?: unknown } | undefined)
        ?.path;
      logger.request(
        req.context,
        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(
          req.method,
        )
          ? req.method
          : 'OTHER',
        typeof route === 'string' ? route : 'UNMATCHED',
        res.statusCode,
        Date.now() - started,
      );
    });
    const reject = (status: number) =>
      res.status(status).json(errorBody(req, status));
    const origin = req.headers.origin;
    res.vary('Origin');
    if (origin !== undefined && config.allowedOrigins.includes(origin)) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader(
        'access-control-expose-headers',
        'x-request-id,x-correlation-id,retry-after',
      );
    }
    const retry = limiter.consume('ip', req.socket.remoteAddress ?? 'unknown');
    if (retry) {
      res.setHeader('retry-after', retry);
      reject(429);
      return;
    }
    if (origin !== undefined && !config.allowedOrigins.includes(origin)) {
      reject(403);
      return;
    }
    if (req.method === 'OPTIONS') {
      const method = req.headers['access-control-request-method'];
      const headers = req.headers['access-control-request-headers'];
      if (
        !origin ||
        typeof method !== 'string' ||
        !['GET', 'POST'].includes(method) ||
        (typeof headers === 'string' &&
          !headers
            .toLowerCase()
            .split(',')
            .every((h) =>
              [
                'authorization',
                'content-type',
                'x-correlation-id',
                'x-request-id',
              ].includes(h.trim()),
            ))
      ) {
        reject(403);
        return;
      }
      res.vary('Access-Control-Request-Headers');
      res.setHeader('access-control-allow-methods', 'GET,POST');
      res.setHeader(
        'access-control-allow-headers',
        'authorization,content-type,x-correlation-id,x-request-id',
      );
      res.setHeader('access-control-max-age', '600');
      res.status(204).end();
      return;
    }
    const hasBody =
      req.headers['transfer-encoding'] !== undefined ||
      (req.headers['content-length'] !== undefined &&
        req.headers['content-length'] !== '0');
    if (
      hasBody &&
      !/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')
    ) {
      reject(415);
      return;
    }
    // Parser failures happen before Nest guards/filters; normalize them here too.
    parser(req, res, (error?: unknown) => {
      if (error) {
        const type = (error as { type?: unknown }).type;
        reject(
          type === 'entity.too.large'
            ? 413
            : type === 'encoding.unsupported'
              ? 415
              : 400,
        );
      } else next();
    });
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new SafeExceptionFilter());
}
