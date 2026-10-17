import {
  BadGatewayException,
  ForbiddenException,
  GatewayTimeoutException,
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { AuthorizationScope } from '@amani/contracts';
import { GATEWAY_CONFIG } from '../config/gateway.config';
import type { GatewayConfig } from '../config/gateway.config';
import type { RequestContext } from '../common/context';
import { SafeLogger } from '../common/logging';
import { ServiceAuthentication } from '../core-client/service-authentication';

@Injectable()
export class DataAnalyticsClient {
  constructor(
    @Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig,
    private readonly auth: ServiceAuthentication,
    private readonly logger: SafeLogger,
  ) {}

  async request(
    context: RequestContext,
    operation: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    scope: AuthorizationScope,
    payload?: object,
  ): Promise<unknown> {
    const body = payload === undefined ? '' : JSON.stringify(payload);
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.dataAnalyticsTimeoutMs,
    );
    const started = Date.now();
    let status = 503;
    try {
      const response = await fetch(this.config.dataAnalyticsBaseUrl + path, {
        method,
        headers: {
          accept: 'application/json',
          ...(body ? { 'content-type': 'application/json' } : {}),
          'x-request-id': context.requestId,
          'x-correlation-id': context.correlationId,
          ...this.auth.headers(context, {
            audience: '@amani/data-analytics',
            method,
            path,
            body,
            scope,
          }),
        },
        ...(body ? { body } : {}),
        signal: controller.signal,
        redirect: 'manual',
      });
      if (response.status === 403) throw new ForbiddenException();
      if (!response.ok) {
        const mapped = [400, 404, 409, 413, 415, 422, 429, 503, 504].includes(
          response.status,
        )
          ? response.status
          : 502;
        throw new HttpException('Data Analytics request failed', mapped);
      }
      const text = await response.text();
      if (Buffer.byteLength(text, 'utf8') > this.config.dataAnalyticsMaxResponseBytes)
        throw new BadGatewayException();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new BadGatewayException();
      }
      status = response.status;
      return parsed;
    } catch (error) {
      if (error instanceof HttpException) {
        status = error.getStatus();
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        status = 504;
        throw new GatewayTimeoutException();
      }
      throw new ServiceUnavailableException();
    } finally {
      clearTimeout(timer);
      this.logger.core(context, operation, status, Date.now() - started);
    }
  }
}
