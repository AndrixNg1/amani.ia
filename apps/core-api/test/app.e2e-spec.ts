import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database';
import { configureHttp } from '../src/common/http';

describe('HTTP boundary without a trusted identity or database', () => {
  let app: INestApplication<App>;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue({
        ready: () => Promise.reject(new Error('synthetic-password SQL detail')),
      })
      .compile();
    app = module.createNestApplication();
    configureHttp(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('keeps process liveness independent of PostgreSQL', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', service: '@amani/core-api' });
    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
  it('reports readiness failure without disclosing driver errors', async () => {
    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503);
    expect(response.text).not.toContain('synthetic-password');
    expect(response.body).toMatchObject({ error: { code: 'UNAVAILABLE' } });
  });
  it.each([
    ['post', '/organizations'],
    ['post', '/users'],
    ['get', '/plans'],
    ['post', '/internal/authorization/check'],
    [
      'get',
      '/internal/authorization/effective-permissions?organizationId=00000000-0000-4000-8000-000000000001',
    ],
    [
      'get',
      '/internal/plugins/knowledge/access?organizationId=00000000-0000-4000-8000-000000000001',
    ],
  ] as const)(
    'denies %s %s even with fabricated identity headers',
    async (method, path) => {
      const response = await request(app.getHttpServer())
        [method](path)
        .set('x-user-id', '00000000-0000-4000-8000-000000000001')
        .set('x-organization-id', '00000000-0000-4000-8000-000000000002')
        .set('authorization', 'Bearer invented')
        .set('x-service-name', '@amani/gateway')
        .expect(403);
      expect(response.body).toMatchObject({
        error: { code: 'FORBIDDEN', message: 'Access denied.' },
      });
    },
  );
  it('propagates bounded tracing IDs without treating them as identity', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'test-request')
      .set('x-correlation-id', 'test-chain')
      .expect(200);
    expect(response.headers['x-request-id']).toBe('test-request');
    expect(response.headers['x-correlation-id']).toBe('test-chain');
    const replaced = await request(app.getHttpServer())
      .get('/health')
      .set('x-correlation-id', 'a'.repeat(129))
      .expect(200);
    expect(replaced.headers['x-correlation-id']).not.toBe('a'.repeat(129));
  });
});
