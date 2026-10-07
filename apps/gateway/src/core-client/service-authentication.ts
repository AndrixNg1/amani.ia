import { createHash, createHmac, randomUUID } from 'node:crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  AuthorizationScope,
  DevelopmentDelegation,
} from '@amani/contracts';
import { principalOf } from '../common/context';
import type { RequestContext } from '../common/context';
import type { GatewayConfig } from '../config/gateway.config';

export interface CoreCall {
  method: 'GET' | 'POST';
  path: string;
  body: string;
  scope: AuthorizationScope;
}
@Injectable()
export abstract class ServiceAuthentication {
  abstract readonly configured: boolean;
  abstract headers(
    context: RequestContext,
    call: CoreCall,
  ): Record<string, string>;
}
class DisabledServiceAuthentication extends ServiceAuthentication {
  readonly configured = false;
  headers(): Record<string, string> {
    throw new ServiceUnavailableException();
  }
}
export class DevelopmentServiceAuthentication extends ServiceAuthentication {
  readonly configured = true;
  constructor(private readonly secret: string) {
    super();
  }
  headers(ctx: RequestContext, call: CoreCall): Record<string, string> {
    const now = Date.now();
    const payload: DevelopmentDelegation = {
      version: 1,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      callingService: '@amani/gateway',
      audience: '@amani/core-api',
      userId: principalOf(ctx).userId,
      ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}),
      scope: call.scope,
      issuedAt: now,
      expiresAt: now + 30000,
      nonce: randomUUID(),
      method: call.method,
      path: call.path,
      bodySha256: createHash('sha256').update(call.body).digest('hex'),
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return {
      'x-amani-development-context': encoded,
      'x-amani-development-signature': createHmac(
        'sha256',
        Buffer.from(this.secret, 'hex'),
      )
        .update(encoded)
        .digest('hex'),
    };
  }
}
export function serviceAuthentication(
  config: GatewayConfig,
): ServiceAuthentication {
  return config.serviceSecret
    ? new DevelopmentServiceAuthentication(config.serviceSecret)
    : new DisabledServiceAuthentication();
}
