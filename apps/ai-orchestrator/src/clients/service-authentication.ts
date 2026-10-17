import { createHash, createHmac, randomUUID } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import type { AuthorizationScope, DevelopmentDelegation } from '@amani/contracts';
import type { Actor } from '../common/context';

export interface SignedCall {
  readonly audience: '@amani/core-api' | '@amani/knowledge';
  readonly method: 'POST';
  readonly path: string;
  readonly body: string;
  readonly scope: AuthorizationScope;
}

/** Creates a short-lived local delegation; it is never a production auth protocol. */
export function signedHeaders(
  actor: Actor,
  secret: string | undefined,
  call: SignedCall,
): Record<string, string> {
  if (!secret) throw new ServiceUnavailableException();
  const now = Date.now();
  const delegation: DevelopmentDelegation = {
    version: 1,
    requestId: actor.requestId,
    correlationId: actor.correlationId,
    callingService: '@amani/ai-orchestrator',
    audience: call.audience,
    userId: actor.userId,
    organizationId: actor.organizationId,
    scope: call.scope,
    issuedAt: now,
    expiresAt: now + 30000,
    nonce: randomUUID(),
    method: call.method,
    path: call.path,
    bodySha256: createHash('sha256').update(call.body).digest('hex'),
  };
  const encoded = Buffer.from(JSON.stringify(delegation)).toString('base64url');
  return {
    'x-request-id': actor.requestId,
    'x-correlation-id': actor.correlationId,
    'x-amani-development-context': encoded,
    'x-amani-development-signature': createHmac(
      'sha256',
      Buffer.from(secret, 'hex'),
    )
      .update(encoded)
      .digest('hex'),
  };
}
