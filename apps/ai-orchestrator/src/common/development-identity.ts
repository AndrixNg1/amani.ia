import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { RawBodyRequest } from '@nestjs/common';
import { ConfigurationError, createEnv } from '@amani/config';
import type { EnvironmentSource } from '@amani/config';
import type { DevelopmentDelegation } from '@amani/contracts';
import { isCorrelationId, isRequestId } from '@amani/shared';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import { IdentityVerifier } from './context';
import type { VerifiedIdentity } from './context';

/** Local-only Gateway delegation verifier; production service authentication is unselected. */
export class DevelopmentIdentityVerifier extends IdentityVerifier {
  private readonly seen = new Map<string, number>();

  constructor(private readonly gatewaySecret: string) {
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
    ) {
      return null;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const delegation = raw as Partial<DevelopmentDelegation>;
    const userId = delegation.userId;
    const organizationId = delegation.organizationId;
    const requestId = delegation.requestId;
    const correlationId = delegation.correlationId;
    const issuedAt = delegation.issuedAt;
    const expiresAt = delegation.expiresAt;
    const nonce = delegation.nonce;
    const scope = delegation.scope;
    if (
      userId === undefined ||
      organizationId === undefined ||
      requestId === undefined ||
      correlationId === undefined ||
      issuedAt === undefined ||
      expiresAt === undefined ||
      nonce === undefined ||
      !scope
    ) {
      return null;
    }
    const expected = createHmac(
      'sha256',
      Buffer.from(this.gatewaySecret, 'hex'),
    )
      .update(encoded)
      .digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return null;
    const now = Date.now();
    if (
      delegation.version !== 1 ||
      delegation.callingService !== '@amani/gateway' ||
      delegation.audience !== '@amani/ai-orchestrator' ||
      !isUUID(userId) ||
      !isUUID(organizationId) ||
      !isRequestId(requestId) ||
      !isCorrelationId(correlationId) ||
      requestId !== request.headers['x-request-id'] ||
      correlationId !== request.headers['x-correlation-id'] ||
      !Number.isSafeInteger(issuedAt) ||
      !Number.isSafeInteger(expiresAt) ||
      expiresAt <= now ||
      issuedAt > now + 1000 ||
      expiresAt <= issuedAt ||
      expiresAt - issuedAt > 30000 ||
      !isUUID(nonce) ||
      delegation.method !== 'POST' ||
      delegation.method !== request.method ||
      delegation.path !== request.originalUrl ||
      delegation.path !== '/ai/knowledge-rag' ||
      scope.action !== 'ai.knowledge-rag.ask' ||
      scope.resourceType !== 'knowledge' ||
      scope.resourceId !== undefined ||
      delegation.bodySha256 !==
        createHash('sha256')
          .update(request.rawBody ?? '')
          .digest('hex')
    ) {
      return null;
    }
    for (const [nonce, expiry] of this.seen) {
      if (expiry <= now) this.seen.delete(nonce);
    }
    if (this.seen.has(nonce) || this.seen.size >= 10000) return null;
    this.seen.set(nonce, expiresAt);
    return {
      userId,
      organizationId,
      callingService: delegation.callingService,
      audience: delegation.audience,
      scope,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }
}

export function identityVerifier(
  source: EnvironmentSource = process.env,
): IdentityVerifier {
  const mode = source.ORCHESTRATOR_SERVICE_AUTH_MODE ?? 'disabled';
  if (mode === 'disabled') return new IdentityVerifier();
  if (mode !== 'development') {
    throw new ConfigurationError(
      'ORCHESTRATOR_SERVICE_AUTH_MODE',
      'invalid_string',
    );
  }
  const env = createEnv(source);
  if (
    !['development', 'test'].includes(env.environment('NODE_ENV')) ||
    !['development', 'test'].includes(
      env.environment('APP_ENV', { default: 'development' }),
    ) ||
    !['127.0.0.1', '::1', 'localhost'].includes(source.HOST ?? '127.0.0.1')
  ) {
    throw new ConfigurationError(
      'ORCHESTRATOR_SERVICE_AUTH_MODE',
      'invalid_environment',
    );
  }
  const secret = env.required('ORCHESTRATOR_GATEWAY_DEVELOPMENT_SECRET');
  if (!/^[a-f0-9]{64}$/.test(secret)) {
    throw new ConfigurationError(
      'ORCHESTRATOR_GATEWAY_DEVELOPMENT_SECRET',
      'invalid_string',
    );
  }
  return new DevelopmentIdentityVerifier(secret);
}
