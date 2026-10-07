import { Inject, Injectable } from '@nestjs/common';
import { GATEWAY_CONFIG } from '../config/gateway.config';
import type { GatewayConfig } from '../config/gateway.config';
import type { RequestContext } from './context';

@Injectable()
export class SafeLogger {
  constructor(@Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig) {}
  request(
    ctx: RequestContext,
    method: string,
    route: string,
    status: number,
    durationMs: number,
  ) {
    this.write({
      event: 'request',
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      method,
      route,
      status,
      durationMs,
    });
  }
  core(
    ctx: RequestContext | undefined,
    operation: string,
    status: number,
    durationMs: number,
  ) {
    this.write({
      event: 'core_request',
      requestId: ctx?.requestId,
      correlationId: ctx?.correlationId,
      operation,
      status,
      durationMs,
    });
  }
  private write(fields: {
    event: string;
    requestId?: string;
    correlationId?: string;
    method?: string;
    route?: string;
    operation?: string;
    status: number;
    durationMs: number;
  }) {
    console.log(
      JSON.stringify({
        service: this.config.service,
        environment: this.config.environment,
        ...fields,
      }),
    );
  }
}
