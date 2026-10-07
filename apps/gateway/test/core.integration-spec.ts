import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { gateway } from './helpers';

interface CoreFixture {
  ready: true;
  baseUrl: string;
  organizationId: string;
  otherOrganizationId: string;
  users: Record<
    | 'owner'
    | 'reader'
    | 'noRole'
    | 'inactive'
    | 'outsider'
    | 'otherOwner'
    | 'platform',
    string
  >;
}
describe('Gateway → actual Core HTTP → PostgreSQL (synthetic rollback fixtures)', () => {
  let child: ChildProcess;
  let core: CoreFixture;
  let app: INestApplication<App>;
  let logs: jest.SpyInstance;
  const token = randomBytes(32).toString('hex');
  const secret = randomBytes(32).toString('hex');
  async function as(name: keyof CoreFixture['users']) {
    if (app) await app.close();
    app = await gateway({
      GATEWAY_AUTH_MODE: 'development',
      GATEWAY_SERVICE_AUTH_MODE: 'development',
      GATEWAY_DEV_BEARER_TOKEN: token,
      GATEWAY_DEV_USER_ID: core.users[name],
      DEVELOPMENT_SERVICE_SECRET: secret,
      CORE_API_BASE_URL: core.baseUrl,
      CORE_API_TIMEOUT_MS: '5000',
    });
  }
  beforeAll(async () => {
    if (process.env.GATEWAY_CORE_TESTS !== 'true')
      throw new Error(
        'Set GATEWAY_CORE_TESTS=true explicitly and start local PostgreSQL; this suite never silently skips.',
      );
    logs = jest.spyOn(console, 'log').mockImplementation(() => {});
    child = fork('test/gateway-fixture.ts', [], {
      cwd: resolve(__dirname, '../../core-api'),
      execArgv: ['-r', 'ts-node/register/transpile-only'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        APP_ENV: 'test',
        HOST: '127.0.0.1',
        CORE_SERVICE_AUTH_MODE: 'development',
        DEVELOPMENT_SERVICE_SECRET: secret,
      },
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    core = await new Promise<CoreFixture>((resolveReady, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Core fixture startup timed out')),
        30000,
      );
      child.once('error', () => {
        clearTimeout(timer);
        reject(new Error('Core fixture could not start'));
      });
      child.once('exit', () => {
        clearTimeout(timer);
        reject(
          new Error(
            'Core fixture exited before startup; check PostgreSQL and Core .env',
          ),
        );
      });
      child.once('message', (message: unknown) => {
        clearTimeout(timer);
        if (
          message &&
          typeof message === 'object' &&
          'ready' in message &&
          message.ready === true
        )
          resolveReady(message as CoreFixture);
        else
          reject(
            new Error('Core fixture failed; check PostgreSQL and Core .env'),
          );
      });
    });
    await as('owner');
  });
  afterAll(async () => {
    if (app) await app.close();
    if (child && child.exitCode === null && child.signalCode === null) {
      await new Promise<void>((done, reject) => {
        const timer = setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error('Core fixture teardown timed out'));
        }, 10000);
        child.once('exit', (code) => {
          clearTimeout(timer);
          if (code === 0 || !core) done();
          else reject(new Error('Core fixture teardown failed'));
        });
        if (child.connected) child.send('stop');
        else child.kill('SIGTERM');
      });
    }
    logs?.mockRestore();
  });
  const get = (path: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('authorization', `Bearer ${token}`);
  it('reads the authenticated user and an authorized organization through real Core', async () => {
    const me = await get('/api/platform/me').expect(200);
    expect(me.body).toMatchObject({ id: core.users.owner });
    const org = await get(`/api/platform/organizations/${core.organizationId}`)
      .set('x-correlation-id', 'real-core-chain')
      .expect(200);
    expect(org.body).toMatchObject({ id: core.organizationId });
    expect(org.headers['x-correlation-id']).toBe('real-core-chain');
    await request(app.getHttpServer()).get('/ready').expect(200);
  });
  it.each(['outsider', 'inactive', 'noRole', 'platform'] as const)(
    'denies %s despite spoofed owner identity and roles',
    async (name) => {
      await as(name);
      await get(`/api/platform/organizations/${core.organizationId}`)
        .set('x-user-id', core.users.owner)
        .set('x-roles', 'owner')
        .expect(403);
    },
  );
  it('allows assigned read permissions and denies missing write permissions', async () => {
    await as('reader');
    await get(`/api/platform/organizations/${core.organizationId}`).expect(200);
    const permissions = await get(
      `/api/platform/organizations/${core.organizationId}/permissions`,
    ).expect(200);
    expect(permissions.body).toHaveProperty(
      'permissions',
      expect.arrayContaining(['organization.read']),
    );
    await request(app.getHttpServer())
      .post(`/api/platform/organizations/${core.organizationId}/memberships`)
      .set('authorization', `Bearer ${token}`)
      .send({ userId: core.users.outsider })
      .expect(403);
  });
  it('denies another organization even with forged organization/service headers', async () => {
    await as('owner');
    await get(`/api/platform/organizations/${core.otherOrganizationId}`)
      .set('x-organization-id', core.organizationId)
      .set('x-internal-service', '@amani/gateway')
      .expect(403);
  });
  it('honors actual active and disabled plugin installations', async () => {
    await as('reader');
    await get(
      `/api/platform/organizations/${core.organizationId}/plugins/knowledge/access`,
    ).expect(200);
    await get(
      `/api/platform/organizations/${core.organizationId}/plugins/connectors/access`,
    ).expect(403);
  });
  it('creates and reads a membership through validated public routes', async () => {
    await as('owner');
    await request(app.getHttpServer())
      .post(`/api/platform/organizations/${core.organizationId}/memberships`)
      .set('authorization', `Bearer ${token}`)
      .send({ userId: core.users.outsider })
      .expect(201);
    const member = await get(
      `/api/platform/organizations/${core.organizationId}/memberships/${core.users.outsider}`,
    ).expect(200);
    expect(member.body).toMatchObject({
      organizationId: core.organizationId,
      userId: core.users.outsider,
      status: 'active',
    });
    await get(
      `/api/platform/organizations/${core.organizationId}/memberships/${randomUUID()}`,
    ).expect(404);
  });
  it('creates an organization once, reports duplicate conflict and rejects forged fields', async () => {
    await as('owner');
    const body = {
      name: 'HTTP Gateway fixture',
      slug: `gateway-${randomUUID()}`,
    };
    const post = () =>
      request(app.getHttpServer())
        .post('/api/platform/organizations')
        .set('authorization', `Bearer ${token}`);
    const created = await post().send(body).expect(201);
    expect(created.body).toMatchObject({ slug: body.slug });
    await post().send(body).expect(409);
    await post()
      .send({ ...body, userId: core.users.platform })
      .expect(400);
  });
  it('rejects an incorrect interservice credential at the actual Core boundary', async () => {
    await app.close();
    app = await gateway({
      GATEWAY_AUTH_MODE: 'development',
      GATEWAY_SERVICE_AUTH_MODE: 'development',
      GATEWAY_DEV_BEARER_TOKEN: token,
      GATEWAY_DEV_USER_ID: core.users.owner,
      DEVELOPMENT_SERVICE_SECRET: randomBytes(32).toString('hex'),
      CORE_API_BASE_URL: core.baseUrl,
    });
    await get('/api/platform/me').expect(403);
  });
});
