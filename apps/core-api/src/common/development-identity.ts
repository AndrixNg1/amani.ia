import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { ConfigurationError, createEnv } from '@amani/config';
import type { EnvironmentSource } from '@amani/config';
import type { DevelopmentDelegation } from '@amani/contracts';
import { isCorrelationId, isRequestId } from '@amani/shared';
import { isUUID } from 'class-validator';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { IdentityVerifier } from './context';
import type { VerifiedIdentity } from './context';

/** A deliberately local adapter, never a production service-auth mechanism. */
export class DevelopmentIdentityVerifier extends IdentityVerifier {
  private readonly seen = new Map<string, number>();
  constructor(private readonly secret: string) {
    super();
  }
  override verify(
    request: RawBodyRequest<Request>,
  ): Promise<VerifiedIdentity | null> {
    return Promise.resolve(this.verifyLocal(request));
  }
  private verifyLocal(
    request: RawBodyRequest<Request>,
  ): VerifiedIdentity | null {
    const encoded = request.headers['x-amani-development-context'];
    const signature = request.headers['x-amani-development-signature'];
    if (
      typeof encoded !== 'string' ||
      encoded.length > 6144 ||
      !/^[\w-]+$/.test(encoded) ||
      typeof signature !== 'string' ||
      !/^[a-f0-9]{64}$/.test(signature)
    )
      return null;
    const expected = createHmac('sha256', Buffer.from(this.secret, 'hex'))
      .update(encoded)
      .digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return null;
    let raw: unknown;
    try {
      raw = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const p = raw as Partial<DevelopmentDelegation>;
    const now = Date.now();
    if (
      p.version !== 1 ||
      p.callingService !== '@amani/gateway' ||
      p.audience !== '@amani/core-api' ||
      !isUUID(p.userId) ||
      (p.organizationId !== undefined && !isUUID(p.organizationId)) ||
      !isRequestId(p.requestId) ||
      !isCorrelationId(p.correlationId) ||
      p.requestId !== request.headers['x-request-id'] ||
      p.correlationId !== request.headers['x-correlation-id'] ||
      typeof p.issuedAt !== 'number' ||
      typeof p.expiresAt !== 'number' ||
      !Number.isSafeInteger(p.issuedAt) ||
      !Number.isSafeInteger(p.expiresAt) ||
      p.expiresAt <= now ||
      p.issuedAt > now + 1000 ||
      p.expiresAt <= p.issuedAt ||
      p.expiresAt - p.issuedAt > 30000 ||
      typeof p.nonce !== 'string' ||
      !isUUID(p.nonce) ||
      !['GET', 'POST'].includes(p.method ?? '') ||
      p.method !== request.method ||
      p.path !== request.originalUrl ||
      typeof p.bodySha256 !== 'string' ||
      p.bodySha256 !==
        createHash('sha256')
          .update(request.rawBody ?? '')
          .digest('hex') ||
      !p.scope ||
      typeof p.scope !== 'object' ||
      Array.isArray(p.scope) ||
      typeof p.scope.action !== 'string' ||
      !/^[a-z][a-z.]{0,79}$/.test(p.scope.action) ||
      typeof p.scope.resourceType !== 'string' ||
      !/^[a-z_]{1,40}$/.test(p.scope.resourceType) ||
      (p.scope.resourceId !== undefined && !isUUID(p.scope.resourceId)) ||
      (p.scope.plugin !== undefined &&
        ![
          'knowledge',
          'data-analytics',
          'conversations',
          'connectors',
          'evaluation',
        ].includes(p.scope.plugin))
    )
      return null;
    for (const [nonce, expiry] of this.seen)
      if (expiry <= now) this.seen.delete(nonce);
    if (this.seen.has(p.nonce) || this.seen.size >= 10000) return null;
    this.seen.set(p.nonce, p.expiresAt);
    return {
      userId: p.userId!,
      organizationId: p.organizationId,
      callingService: p.callingService,
      audience: p.audience,
      scope: p.scope,
      expiresAt: new Date(p.expiresAt).toISOString(),
    };
  }
}
export function identityVerifier(
  source: EnvironmentSource = process.env,
): IdentityVerifier {
  const env = createEnv(source);
  const mode = source.CORE_SERVICE_AUTH_MODE ?? 'disabled';
  if (mode === 'disabled') return new IdentityVerifier();
  if (mode !== 'development')
    throw new ConfigurationError('CORE_SERVICE_AUTH_MODE', 'invalid_string');
  if (
    !['development', 'test'].includes(env.environment('NODE_ENV')) ||
    !['development', 'test'].includes(
      env.environment('APP_ENV', { default: 'development' }),
    ) ||
    !['127.0.0.1', '::1', 'localhost'].includes(source.HOST ?? '127.0.0.1')
  ) {
    throw new ConfigurationError(
      'CORE_SERVICE_AUTH_MODE',
      'invalid_environment',
    );
  }
  const secret = env.required('DEVELOPMENT_SERVICE_SECRET');
  if (!/^[a-f0-9]{64}$/.test(secret))
    throw new ConfigurationError(
      'DEVELOPMENT_SERVICE_SECRET',
      'invalid_string',
    );
  return new DevelopmentIdentityVerifier(secret);
}
