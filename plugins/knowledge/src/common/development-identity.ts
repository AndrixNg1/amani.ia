import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ConfigurationError, createEnv } from '@amani/config';
import type { EnvironmentSource } from '@amani/config';
import type { DevelopmentDelegation } from '@amani/contracts';
import { isCorrelationId, isRequestId } from '@amani/shared';
import { isUUID } from 'class-validator';
import { IdentityVerifier } from './context';
import type { VerifiedIdentity } from './context';

/** Local-only adapter; production service authentication remains deliberately unselected. */
export class DevelopmentIdentityVerifier extends IdentityVerifier {
  private readonly seen = new Map<string, number>();
  constructor(
    private readonly gatewaySecret: string,
    private readonly documentProcessingSecret: string,
  ) {
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
    let raw: unknown;
    try {
      raw = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const p = raw as Partial<DevelopmentDelegation>;
    const secret =
      p.callingService === '@amani/gateway'
        ? this.gatewaySecret
        : p.callingService === '@amani/document-processing'
          ? this.documentProcessingSecret
          : undefined;
    if (!secret) return null;
    const expected = createHmac('sha256', Buffer.from(secret, 'hex'))
      .update(encoded)
      .digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return null;
    const now = Date.now();
    if (
      p.version !== 1 ||
      !['@amani/gateway', '@amani/document-processing'].includes(
        p.callingService ?? '',
      ) ||
      p.audience !== '@amani/knowledge' ||
      !isUUID(p.userId) ||
      (p.organizationId !== undefined && !isUUID(p.organizationId)) ||
      !isRequestId(p.requestId) ||
      !isCorrelationId(p.correlationId) ||
      p.requestId !== request.headers['x-request-id'] ||
      p.correlationId !== request.headers['x-correlation-id'] ||
      !Number.isSafeInteger(p.issuedAt) ||
      !Number.isSafeInteger(p.expiresAt) ||
      p.expiresAt! <= now ||
      p.issuedAt! > now + 1000 ||
      p.expiresAt! <= p.issuedAt! ||
      p.expiresAt! - p.issuedAt! > 30000 ||
      typeof p.nonce !== 'string' ||
      !isUUID(p.nonce) ||
      !['GET', 'POST', 'PATCH', 'DELETE'].includes(p.method ?? '') ||
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
      (p.scope.resourceId !== undefined && !isUUID(p.scope.resourceId))
    )
      return null;
    for (const [nonce, expiry] of this.seen)
      if (expiry <= now) this.seen.delete(nonce);
    if (this.seen.has(p.nonce) || this.seen.size >= 10000) return null;
    this.seen.set(p.nonce, p.expiresAt!);
    return {
      userId: p.userId!,
      organizationId: p.organizationId,
      callingService: p.callingService,
      audience: p.audience,
      scope: p.scope,
      expiresAt: new Date(p.expiresAt!).toISOString(),
    };
  }
}
export function identityVerifier(
  source: EnvironmentSource = process.env,
): IdentityVerifier {
  const mode = source.KNOWLEDGE_SERVICE_AUTH_MODE ?? 'disabled';
  if (mode === 'disabled') return new IdentityVerifier();
  if (mode !== 'development')
    throw new ConfigurationError(
      'KNOWLEDGE_SERVICE_AUTH_MODE',
      'invalid_string',
    );
  const env = createEnv(source);
  if (
    !['development', 'test'].includes(env.environment('NODE_ENV')) ||
    !['development', 'test'].includes(
      env.environment('APP_ENV', { default: 'development' }),
    ) ||
    !['127.0.0.1', '::1', 'localhost'].includes(source.HOST ?? '127.0.0.1')
  )
    throw new ConfigurationError(
      'KNOWLEDGE_SERVICE_AUTH_MODE',
      'invalid_environment',
    );
  const secret = env.required('KNOWLEDGE_DEVELOPMENT_SERVICE_SECRET');
  if (!/^[a-f0-9]{64}$/.test(secret))
    throw new ConfigurationError(
      'KNOWLEDGE_DEVELOPMENT_SERVICE_SECRET',
      'invalid_string',
    );
  return new DevelopmentIdentityVerifier(
    secret,
    env.required('KNOWLEDGE_DOCUMENT_PROCESSING_DEVELOPMENT_SECRET'),
  );
}
