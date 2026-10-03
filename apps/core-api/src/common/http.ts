import { Catch, HttpException, ValidationPipe } from '@nestjs/common';
import type {
  ArgumentsHost,
  ExceptionFilter,
  INestApplication,
} from '@nestjs/common';
import {
  createRequestId,
  isRequestId,
  resolveCorrelationId,
} from '@amani/shared';
import type { ErrorEnvelope } from '@amani/contracts';
import type { NextFunction, Response } from 'express';
import type { CoreRequest } from './context';

function databaseCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return;
  const item = error as { code?: unknown; cause?: unknown };
  if (typeof item.code === 'string') return item.code;
  if (item.cause && typeof item.cause === 'object') {
    const code = (item.cause as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
}
@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<CoreRequest>();
    const code = databaseCode(error);
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : code === '23505' || code === '40001' || code === '40P01'
          ? 409
          : code === '23503' || code === '23514' || code === '22P02'
            ? 400
            : code &&
                (code.startsWith('08') ||
                  code.startsWith('57') ||
                  ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'].includes(code))
              ? 503
              : 500;
    const errors: Record<number, [string, string]> = {
      400: ['INVALID_REQUEST', 'Invalid request.'],
      403: ['FORBIDDEN', 'Access denied.'],
      404: ['NOT_FOUND', 'Resource not found.'],
      409: ['CONFLICT', 'Operation conflicts with current state.'],
      503: ['UNAVAILABLE', 'Service unavailable.'],
      500: ['INTERNAL_ERROR', 'Request failed.'],
    };
    const [errorCode, message] = errors[status] ?? [
      'INTERNAL_ERROR',
      'Request failed.',
    ];
    const body: ErrorEnvelope = {
      error: { code: errorCode, message },
      meta: {
        requestId: isRequestId(response.getHeader('x-request-id'))
          ? (response.getHeader('x-request-id') as ReturnType<
              typeof createRequestId
            >)
          : createRequestId(),
        correlationId: request.correlationId ?? resolveCorrelationId(undefined),
        timestamp: new Date().toISOString(),
        apiVersion: '1',
      },
    };
    response.status(status).json(body);
  }
}
export function configureHttp(app: INestApplication) {
  app.use((req: CoreRequest, res: Response, next: NextFunction) => {
    const requestId = isRequestId(req.headers['x-request-id'])
      ? req.headers['x-request-id']
      : createRequestId();
    req.correlationId = resolveCorrelationId(req.headers['x-correlation-id']);
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-correlation-id', req.correlationId);
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    }),
  );
  app.useGlobalFilters(new SafeExceptionFilter());
}
