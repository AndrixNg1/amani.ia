import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { Request } from 'express';
import type { RawBodyRequest } from '@nestjs/common';
import type { DevelopmentDelegation } from '@amani/contracts';
import type { UserId, RequestId, CorrelationId } from '@amani/types';
import {
  DevelopmentIdentityVerifier,
  identityVerifier,
} from './development-identity';

const secret = randomBytes(32).toString('hex');
function fixture(change: Record<string, unknown> = {}) {
  const body = '{"name":"Synthetic","slug":"synthetic"}';
  const now = Date.now();
  const payload: DevelopmentDelegation = {
    version: 1,
    userId: randomUUID() as UserId,
    requestId: randomUUID() as RequestId,
    correlationId: randomUUID() as CorrelationId,
    callingService: '@amani/gateway',
    audience: '@amani/core-api',
    scope: { action: 'organization.create', resourceType: 'organization' },
    issuedAt: now,
    expiresAt: now + 30000,
    nonce: randomUUID(),
    method: 'POST',
    path: '/organizations',
    bodySha256: createHash('sha256').update(body).digest('hex'),
    ...change,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return {
    payload,
    request: {
      method: 'POST',
      originalUrl: '/organizations',
      rawBody: Buffer.from(body),
      headers: {
        'x-request-id': payload.requestId,
        'x-correlation-id': payload.correlationId,
        'x-amani-development-context': encoded,
        'x-amani-development-signature': createHmac(
          'sha256',
          Buffer.from(secret, 'hex'),
        )
          .update(encoded)
          .digest('hex'),
      },
    } as unknown as RawBodyRequest<Request>,
  };
}
describe('Development delegation verifier', () => {
  it('accepts a signed, bound request once and rejects replay', async () => {
    const verifier = new DevelopmentIdentityVerifier(secret);
    const { payload, request } = fixture();
    expect(await verifier.verify(request)).toMatchObject({
      userId: payload.userId,
      scope: payload.scope,
    });
    expect(await verifier.verify(request)).toBeNull();
  });
  it.each([
    { audience: '@amani/knowledge' },
    { callingService: 'external' },
    { expiresAt: 0 },
    { expiresAt: Date.now() + 600000 },
    { issuedAt: Date.now() + 60000 },
    { userId: 'invented' },
    { organizationId: 'invented' },
    { method: 'GET' },
    { path: '/users' },
    { scope: { action: 42 } },
    { bodySha256: '0'.repeat(64) },
  ])('rejects invalid signed delegation: %j', async (change) => {
    expect(
      await new DevelopmentIdentityVerifier(secret).verify(
        fixture(change).request,
      ),
    ).toBeNull();
  });
  it('rejects altered signatures, tracing metadata, payloads and bodies', async () => {
    const verifier = new DevelopmentIdentityVerifier(secret);
    for (const mutate of [
      (req: RawBodyRequest<Request>) => {
        req.headers['x-amani-development-signature'] = '0'.repeat(64);
      },
      (req: RawBodyRequest<Request>) => {
        req.headers['x-correlation-id'] = 'forged';
      },
      (req: RawBodyRequest<Request>) => {
        req.headers['x-amani-development-context'] = 'not-json';
      },
      (req: RawBodyRequest<Request>) => {
        req.rawBody = Buffer.from('{}');
      },
    ]) {
      const { request } = fixture();
      mutate(request);
      expect(await verifier.verify(request)).toBeNull();
    }
  });
  it('defaults closed and forbids the adapter in production, staging, missing NODE_ENV and external listeners', async () => {
    expect(await identityVerifier({}).verify(fixture().request)).toBeNull();
    const configured = {
      NODE_ENV: 'test',
      CORE_SERVICE_AUTH_MODE: 'development',
      DEVELOPMENT_SERVICE_SECRET: secret,
    };
    expect(identityVerifier(configured)).toBeInstanceOf(
      DevelopmentIdentityVerifier,
    );
    for (const extra of [
      { NODE_ENV: 'production' },
      { APP_ENV: 'staging' },
      { NODE_ENV: undefined },
      { HOST: '0.0.0.0' },
    ])
      expect(() => identityVerifier({ ...configured, ...extra })).toThrow();
  });
});
