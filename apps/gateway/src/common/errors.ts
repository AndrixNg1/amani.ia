import { Catch, HttpException } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import type { ErrorEnvelope } from '@amani/contracts';
import type { GatewayRequest } from './context';

const messages: Record<number, [string, string]> = {
  400: ['INVALID_REQUEST', 'Invalid request.'],
  401: ['UNAUTHENTICATED', 'Authentication required.'],
  403: ['FORBIDDEN', 'Access denied.'],
  404: ['NOT_FOUND', 'Resource not found.'],
  409: ['CONFLICT', 'Operation conflicts with current state.'],
  413: ['PAYLOAD_TOO_LARGE', 'Request body too large.'],
  415: ['UNSUPPORTED_MEDIA_TYPE', 'JSON content required.'],
  429: ['RATE_LIMITED', 'Too many requests.'],
  500: ['INTERNAL_ERROR', 'Request failed.'],
  502: ['BAD_GATEWAY', 'Invalid backend response.'],
  503: ['UNAVAILABLE', 'Service unavailable.'],
  504: ['GATEWAY_TIMEOUT', 'Backend request timed out.'],
};
export function errorBody(req: GatewayRequest, status: number): ErrorEnvelope {
  const [code, message] = messages[status] ?? messages[500];
  return {
    error: { code, message },
    meta: {
      requestId: req.context.requestId,
      correlationId: req.context.correlationId,
      timestamp: new Date().toISOString(),
      apiVersion: '1',
    },
  };
}
@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest<GatewayRequest>();
    const candidate = error instanceof HttpException ? error.getStatus() : 500;
    const status = messages[candidate] ? candidate : 500;
    if (!res.headersSent) res.status(status).json(errorBody(req, status));
  }
}
