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
import type { AnalyticsRequest } from './context';

function codeOf(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return;
  const value = error as { code?: unknown; cause?: { code?: unknown } };
  return typeof value.code === 'string'
    ? value.code
    : typeof value.cause?.code === 'string'
      ? value.cause.code
      : undefined;
}
@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<AnalyticsRequest>();
    const dbCode = codeOf(error);
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : ['23505', '40001', '40P01'].includes(dbCode ?? '')
          ? 409
          : ['23503', '23514', '22P02'].includes(dbCode ?? '')
            ? 400
            : dbCode &&
                (dbCode.startsWith('08') ||
                  ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'].includes(dbCode))
              ? 503
              : 500;
    const messages: Record<number, [string, string]> = {
      400: ['INVALID_REQUEST', 'Invalid request.'],
      403: ['FORBIDDEN', 'Access denied.'],
      404: ['NOT_FOUND', 'Resource not found.'],
      409: ['CONFLICT', 'Operation conflicts with current state.'],
      413: ['PAYLOAD_TOO_LARGE', 'File is too large.'],
      415: ['UNSUPPORTED_MEDIA_TYPE', 'Unsupported structured file type.'],
      422: ['INVALID_ANALYSIS_OPERATION', 'Invalid analysis operation.'],
      502: ['BAD_GATEWAY', 'Required backend returned an invalid response.'],
      503: ['UNAVAILABLE', 'Required service is unavailable.'],
      504: ['GATEWAY_TIMEOUT', 'Required service timed out.'],
      500: ['INTERNAL_ERROR', 'Request failed.'],
    };
    const [errorCode, message] = messages[status] ?? messages[500];
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
  app.use((req: AnalyticsRequest, res: Response, next: NextFunction) => {
    const requestId = isRequestId(req.headers['x-request-id'])
      ? req.headers['x-request-id']
      : createRequestId();
    req.requestId = requestId;
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
