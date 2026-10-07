import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { DevelopmentDelegation } from '@amani/contracts';
import { gateway } from './helpers';

const token = randomBytes(32).toString('hex');
const secret = randomBytes(32).toString('hex');
const userId = randomUUID();
const orgId = randomUUID();
const local = {
  GATEWAY_AUTH_MODE: 'development',
  GATEWAY_SERVICE_AUTH_MODE: 'development',
  GATEWAY_DEV_BEARER_TOKEN: token,
  GATEWAY_DEV_USER_ID: userId,
  DEVELOPMENT_SERVICE_SECRET: secret,
};
const org = {
  id: orgId,
  name: 'Synthetic',
  slug: 'synthetic',
  status: 'active',
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};
const profile = {
  ...org,
  id: userId,
  email: 'synthetic@example.invalid',
  displayName: 'Synthetic',
};
type Call = {
  headers: IncomingMessage['headers'];
  path: string;
  body: unknown;
  delegation: DevelopmentDelegation;
};
describe('Gateway edge and real HTTP Core transport', () => {
  let app: INestApplication<App>;
  let core: Server;
  let base: string;
  let respond: (
    req: IncomingMessage,
    res: ServerResponse,
    body: unknown,
  ) => void;
  let calls: Call[];
  let logs: jest.SpyInstance;
  const ok = (res: ServerResponse, value: unknown) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(value));
  };
  beforeAll(async () => {
    logs = jest.spyOn(console, 'log').mockImplementation(() => {});
    core = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const body: unknown = chunks.length
          ? JSON.parse(Buffer.concat(chunks).toString())
          : undefined;
        const raw = req.headers['x-amani-development-context'] as
          string | undefined;
        const delegation: DevelopmentDelegation = raw
          ? (JSON.parse(
              Buffer.from(raw, 'base64url').toString(),
            ) as DevelopmentDelegation)
          : ({} as DevelopmentDelegation);
        calls.push({ headers: req.headers, path: req.url!, body, delegation });
        respond(req, res, body);
      });
    });
    await new Promise<void>((resolve) => core.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(core.address() as AddressInfo).port}`;
  });
  beforeEach(async () => {
    calls = [];
    logs.mockClear();
    respond = (req, res, body) => {
      if (req.url === '/internal/authorization/check') {
        const input = body as { permission: string; organizationId: string };
        ok(res, {
          allowed: true,
          reason: 'ROLE_PERMISSION',
          userId,
          organizationId: input.organizationId,
          permission: input.permission,
        });
      } else if (req.url === '/health/ready')
        ok(res, {
          status: 'ok',
          service: '@amani/core-api',
          database: 'ready',
        });
      else if (req.url?.startsWith('/users/')) ok(res, profile);
      else ok(res, org);
    };
    app = await gateway({
      ...local,
      CORE_API_BASE_URL: base,
      CORE_API_TIMEOUT_MS: '300',
    });
  });
  afterEach(async () => {
    await app.close();
  });
  afterAll(async () => {
    core.closeAllConnections();
    await new Promise<void>((resolve) => core.close(() => resolve()));
    logs.mockRestore();
  });
  const get = (path: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('authorization', `Bearer ${token}`);
  it('serves liveness, unique request IDs, bounded correlation IDs and genuine Core readiness', async () => {
    const first = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'external-request')
      .expect(200);
    expect(first.body).toEqual({ status: 'ok', service: '@amani/gateway' });
    expect(first.headers['x-request-id']).not.toBe('external-request');
    expect(first.headers['x-correlation-id']).toBeTruthy();
    const second = await request(app.getHttpServer())
      .get('/health')
      .set('x-correlation-id', 'bad'.repeat(100))
      .expect(200);
    expect(second.headers['x-request-id']).not.toBe(
      first.headers['x-request-id'],
    );
    expect(second.headers['x-correlation-id'].length).toBeLessThan(129);
    await request(app.getHttpServer()).get('/ready').expect(200);
    respond = (_req, res) => {
      res.statusCode = 503;
      res.end();
    };
    await request(app.getHttpServer()).get('/ready').expect(503);
  });
  it('requires authentication despite forged identity/service headers and defaults closed', async () => {
    await request(app.getHttpServer())
      .get(`/api/platform/organizations/${orgId}`)
      .set('x-user-id', userId)
      .set('x-internal-service', '@amani/gateway')
      .set('x-roles', 'owner')
      .expect(401);
    expect(calls).toHaveLength(0);
    await app.close();
    app = await gateway();
    await get('/api/platform/me').expect(401);
    await request(app.getHttpServer()).get('/ready').expect(503);
  });
  it('binds context to the authenticated principal and URL, propagates correlation, and allowlists headers', async () => {
    const res = await get(`/api/platform/organizations/${orgId}`)
      .set('x-user-id', randomUUID())
      .set('x-organization-id', randomUUID())
      .set('x-internal-service', 'fake')
      .set('x-amani-development-context', 'forged')
      .set('x-amani-development-signature', 'forged')
      .set('x-roles', 'owner')
      .set('x-permissions', '*')
      .set('cookie', 'secret-cookie')
      .set('x-correlation-id', 'synthetic-chain')
      .expect(200);
    expect(res.body).toEqual(org);
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.delegation).toMatchObject({
        userId,
        organizationId: orgId,
        callingService: '@amani/gateway',
        correlationId: 'synthetic-chain',
        requestId: res.headers['x-request-id'],
      });
      for (const header of [
        'authorization',
        'cookie',
        'x-user-id',
        'x-organization-id',
        'x-internal-service',
        'x-roles',
        'x-permissions',
      ])
        expect(call.headers[header]).toBeUndefined();
      expect(call.headers['x-amani-development-signature']).toBe(
        createHmac('sha256', Buffer.from(secret, 'hex'))
          .update(call.headers['x-amani-development-context'] as string)
          .digest('hex'),
      );
    }
  });
  it.each([400, 403, 404, 409, 429, 500, 503, 504])(
    'maps Core %s without exposing backend details',
    async (status) => {
      respond = (_req, res) => {
        res.statusCode = status;
        ok(res, { password: 'secret-sql-error', stack: 'private' });
      };
      const res = await get('/api/platform/me').expect(
        status === 500 ? 502 : status,
      );
      expect(res.body).toHaveProperty('error.code');
      expect(res.body).toHaveProperty('meta.requestId');
      expect(res.text).not.toContain('secret-sql-error');
      expect(res.text).not.toContain(base);
    },
  );
  it.each(['headers', 'body'])(
    'times out while waiting for %s without failing open',
    async (mode) => {
      respond = (_req, res) => {
        if (mode === 'body') {
          res.setHeader('content-type', 'application/json');
          res.write('{');
        }
      };
      await get(`/api/platform/organizations/${orgId}`).expect(504);
      expect(calls).toHaveLength(1);
    },
  );
  it('maps connection failure to 503', async () => {
    const closed = createServer();
    await new Promise<void>((resolve) =>
      closed.listen(0, '127.0.0.1', resolve),
    );
    const port = (closed.address() as AddressInfo).port;
    await new Promise<void>((resolve) => closed.close(() => resolve()));
    await app.close();
    app = await gateway({
      ...local,
      CORE_API_BASE_URL: `http://127.0.0.1:${port}`,
    });
    await get('/api/platform/me').expect(503);
  });
  it.each(['json', 'type', 'large', 'redirect', 'identity'])(
    'rejects malformed/unexpected Core responses: %s',
    async (mode) => {
      respond = (_req, res) => {
        if (mode === 'json') {
          res.setHeader('content-type', 'application/json');
          res.end('{bad');
        }
        if (mode === 'type') res.end('private stack');
        if (mode === 'large') ok(res, { text: 'x'.repeat(270000) });
        if (mode === 'redirect') {
          res.statusCode = 302;
          res.setHeader('location', '/users/elsewhere');
          res.end();
        }
        if (mode === 'identity') ok(res, { ...profile, id: randomUUID() });
      };
      await get('/api/platform/me').expect(502);
      expect(calls).toHaveLength(1);
    },
  );
  it.each([
    { allowed: false, reason: 'INACTIVE_CONTEXT' },
    { allowed: false, reason: 'MISSING_PERMISSION' },
    { allowed: false, reason: 'WRONG_ORGANIZATION' },
    { allowed: false, reason: 'PLUGIN_UNAVAILABLE' },
    { allowed: 'true', reason: 'ROLE_PERMISSION' },
    { allowed: true, reason: 'MISSING_PERMISSION' },
    { allowed: true, reason: 'ROLE_PERMISSION', userId: randomUUID() },
    { allowed: true, reason: 'ROLE_PERMISSION', organizationId: randomUUID() },
    { allowed: true, reason: 'ROLE_PERMISSION', permission: 'roles.manage' },
  ])(
    'requires an explicit, matching Core permission decision: %j',
    async (change) => {
      respond = (_req, res) =>
        ok(res, {
          userId,
          organizationId: orgId,
          permission: 'organization.read',
          ...change,
        });
      await get(`/api/platform/organizations/${orgId}`).expect(
        change.allowed === false ? 403 : 502,
      );
      expect(calls).toHaveLength(1);
    },
  );
  it('validates inputs, rejects unknown fields and bounds/normalizes all JSON parser failures', async () => {
    await request(app.getHttpServer())
      .post('/api/platform/organizations')
      .set('authorization', `Bearer ${token}`)
      .send({ name: ' ', slug: 'bad', roles: ['owner'] })
      .expect(400);
    await get('/api/platform/organizations/not-a-uuid').expect(400);
    await get(
      `/api/platform/organizations/${orgId}/plugins/fake/access`,
    ).expect(400);
    expect(calls).toHaveLength(0);
    for (const [payload, expected, contentType] of [
      ['{"bad"', 400, 'application/json'],
      ['x'.repeat(66000), 413, 'application/json'],
      ['private', 415, 'text/plain'],
    ] as const) {
      const result = await request(app.getHttpServer())
        .post('/api/platform/organizations')
        .set('content-type', contentType)
        .send(payload)
        .expect(expected);
      expect(result.body).toHaveProperty('error.code');
      expect(result.headers['x-content-type-options']).toBe('nosniff');
    }
  });
  it('creates an organization once and never retries failed POSTs', async () => {
    await request(app.getHttpServer())
      .post('/api/platform/organizations')
      .set('authorization', `Bearer ${token}`)
      .send({ name: 'Synthetic', slug: 'synthetic' })
      .expect(201);
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ name: 'Synthetic', slug: 'synthetic' });
    respond = (_req, res) => {
      res.statusCode = 500;
      res.end();
    };
    await request(app.getHttpServer())
      .post('/api/platform/organizations')
      .set('authorization', `Bearer ${token}`)
      .send({ name: 'Synthetic', slug: 'synthetic' })
      .expect(502);
    expect(calls).toHaveLength(2);
  });
  it('enforces exact CORS origins and headers with security defaults', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/health')
      .set('origin', 'http://localhost:3000')
      .expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    expect(allowed.headers['access-control-allow-credentials']).toBeUndefined();
    expect(allowed.headers['x-powered-by']).toBeUndefined();
    expect(allowed.headers['x-frame-options']).toBe('DENY');
    await request(app.getHttpServer())
      .get('/health')
      .set('origin', 'http://localhost:3000.evil.invalid')
      .expect(403);
    await request(app.getHttpServer())
      .options('/api/platform/me')
      .set('origin', 'http://localhost:3000')
      .set('access-control-request-method', 'GET')
      .set('access-control-request-headers', 'authorization')
      .expect(204);
    await request(app.getHttpServer())
      .options('/api/platform/me')
      .set('origin', 'http://localhost:3000')
      .set('access-control-request-method', 'GET')
      .set('access-control-request-headers', 'x-user-id')
      .expect(403);
  });
  it('limits the actual source IP despite forged proxy headers', async () => {
    await app.close();
    app = await gateway({ GATEWAY_RATE_IP: '1' });
    await request(app.getHttpServer())
      .get('/health')
      .set('x-forwarded-for', '1.1.1.1')
      .expect(200);
    const limited = await request(app.getHttpServer())
      .get('/health')
      .set('x-forwarded-for', '2.2.2.2')
      .expect(429);
    expect(limited.headers['retry-after']).toBeTruthy();
    expect(limited.body).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });
  it('normalizes UUID case and projects only known response fields', async () => {
    const previous = respond;
    respond = (req, res, body) => {
      if (req.url?.startsWith('/organizations/'))
        ok(res, { ...org, internalSecret: 'never-expose' });
      else previous(req, res, body);
    };
    const result = await get(
      `/api/platform/organizations/${orgId.toUpperCase()}`,
    ).expect(200);
    expect(result.body).toEqual(org);
    expect(result.text).not.toContain('never-expose');
  });
  it.each(['status', 'date', 'http-status'])(
    'rejects corrupt successful Core contracts: %s',
    async (mode) => {
      respond = (_req, res) => {
        if (mode === 'http-status') res.statusCode = 202;
        ok(res, {
          ...profile,
          ...(mode === 'status' ? { status: 'invented' } : {}),
          ...(mode === 'date' ? { createdAt: '12' } : {}),
        });
      };
      await get('/api/platform/me').expect(502);
    },
  );
  it('does not contact Core without configured service authentication', async () => {
    await app.close();
    app = await gateway({
      ...local,
      GATEWAY_SERVICE_AUTH_MODE: 'disabled',
      CORE_API_BASE_URL: base,
    });
    await get('/api/platform/me').expect(503);
    expect(calls).toHaveLength(0);
  });
  it('limits authenticated users before Core and organizations after explicit allow', async () => {
    await app.close();
    app = await gateway({
      ...local,
      CORE_API_BASE_URL: base,
      GATEWAY_RATE_USER: '1',
    });
    await get('/api/platform/me').expect(200);
    await get('/api/platform/me').expect(429);
    expect(calls).toHaveLength(1);
    await app.close();
    app = await gateway({
      ...local,
      CORE_API_BASE_URL: base,
      GATEWAY_RATE_ORGANIZATION: '1',
    });
    calls = [];
    await get(`/api/platform/organizations/${orgId}`).expect(200);
    await get(`/api/platform/organizations/${orgId}`).expect(429);
    expect(
      calls.filter((call) => call.path === '/internal/authorization/check'),
    ).toHaveLength(2);
    expect(
      calls.filter((call) => call.path === `/organizations/${orgId}`),
    ).toHaveLength(1);
  });
  it('preserves CORS headers on local quota errors', async () => {
    await app.close();
    app = await gateway({ GATEWAY_RATE_IP: '1' });
    await request(app.getHttpServer())
      .get('/health')
      .set('origin', 'http://localhost:3000')
      .expect(200);
    const result = await request(app.getHttpServer())
      .get('/health')
      .set('origin', 'http://localhost:3000')
      .expect(429);
    expect(result.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
  });
  it('applies HSTS with closed authentication in production', async () => {
    await app.close();
    app = await gateway({
      NODE_ENV: 'production',
      CORE_API_BASE_URL: 'https://core.example.invalid',
    });
    const result = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    expect(result.headers['strict-transport-security']).toBe(
      'max-age=31536000',
    );
    await get('/api/platform/me').expect(401);
  });
  it('logs only metadata and leaves unavailable service families unrouted', async () => {
    await get(`/api/platform/organizations/${orgId}?private=secret-query`)
      .set('cookie', 'secret-cookie')
      .expect(200);
    for (const path of [
      '/api/knowledge',
      '/api/ai/test',
      '/core/users',
      '/api/platform/users',
    ])
      await get(path).expect(404);
    const output = JSON.stringify(logs.mock.calls);
    for (const sensitive of [
      token,
      secret,
      'secret-cookie',
      'secret-query',
      orgId,
      base,
      'x-amani-development-signature',
    ])
      expect(output).not.toContain(sensitive);
    expect(output).toContain('/api/platform/organizations/:organizationId');
    expect(output).toContain('correlationId');
  });
});
