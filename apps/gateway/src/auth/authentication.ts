import { createHash, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '@amani/contracts';
import type { GatewayConfig } from '../config/gateway.config';

@Injectable()
export abstract class AuthenticationProvider {
  abstract authenticate(
    authorization: string | undefined,
  ): Promise<AuthenticatedPrincipal | null>;
  abstract readonly configured: boolean;
}
export class DisabledAuthentication extends AuthenticationProvider {
  readonly configured = false;
  authenticate(): Promise<null> {
    return Promise.resolve(null);
  }
}
export class DevelopmentAuthentication extends AuthenticationProvider {
  readonly configured = true;
  constructor(private readonly config: GatewayConfig) {
    super();
  }
  authenticate(
    authorization: string | undefined,
  ): Promise<AuthenticatedPrincipal | null> {
    const expected = this.config.devToken;
    const match = /^Bearer ([a-f0-9]{64})$/.exec(authorization ?? '');
    if (!expected || !this.config.devUserId || !match)
      return Promise.resolve(null);
    const hash = (text: string) => createHash('sha256').update(text).digest();
    if (!timingSafeEqual(hash(expected), hash(match[1])))
      return Promise.resolve(null);
    return Promise.resolve({
      userId: this.config.devUserId,
      authenticationMethod: 'development-token',
      issuedAt: new Date().toISOString(),
    });
  }
}
export function authenticationProvider(
  config: GatewayConfig,
): AuthenticationProvider {
  return config.devToken
    ? new DevelopmentAuthentication(config)
    : new DisabledAuthentication();
}
