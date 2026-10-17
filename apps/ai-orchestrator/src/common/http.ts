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
import type { OrchestratorRequest } from './context';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<OrchestratorRequest>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const messages: Record<number, [string, string]> = {
      400: ['INVALID_REQUEST', 'Invalid request.'],
      403: ['FORBIDDEN', 'Access denied.'],
      502: ['BAD_GATEWAY', 'Required backend returned an invalid response.'],
      503: ['UNAVAILABLE', 'Required service is unavailable.'],
      504: ['GATEWAY_TIMEOUT', 'Required service timed out.'],
      500: ['INTERNAL_ERROR', 'Request failed.'],
    };
    const [code, message] = messages[status] ?? messages[500];
    const body: ErrorEnvelope = {
      error: { code, message },
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
  app.use((req: OrchestratorRequest, res: Response, next: NextFunction) => {
    req.requestId = isRequestId(req.headers['x-request-id'])
      ? req.headers['x-request-id']
      : createRequestId();
    req.correlationId = resolveCorrelationId(req.headers['x-correlation-id']);
    res.setHeader('x-request-id', req.requestId);
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
