import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { IdentityVerifier, TrustedIdentityGuard } from '../src/common/context';
import { configureHttp } from '../src/common/http';
import { RetrievalController } from '../src/retrieval/retrieval.controller';
import { RetrievalService } from '../src/retrieval/retrieval.service';

const organizationId = '00000000-0000-4000-8000-000000000010';
const knowledgeBaseId = '00000000-0000-4000-8000-000000000102';
const requestId = '00000000-0000-4000-8000-000000000011';
const correlationId = '00000000-0000-4000-8000-000000000012';

describe('Knowledge retrieval HTTP boundary (e2e)', () => {
  let app: INestApplication<App>;
  const retrieve = jest.fn(() =>
    Promise.resolve({
      type: 'knowledge.retrieval.results' as const,
      version: 1 as const,
      retrievalProfile: {
        provider: 'deterministic-test',
        model: 'deterministic-v1',
        dimension: 3,
        configVersion: 1,
        metric: 'cosine' as const,
      },
      results: [],
    }),
  );
  const identity = {
    userId: '00000000-0000-4000-8000-000000000001',
    organizationId,
    callingService: '@amani/gateway' as const,
    audience: '@amani/knowledge' as const,
    scope: {
      action: 'knowledge.documents.read',
      resourceType: 'knowledge_base',
      resourceId: knowledgeBaseId,
    },
    expiresAt: new Date(Date.now() + 30_000).toISOString(),
  };

  beforeEach(async () => {
    retrieve.mockClear();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RetrievalController],
      providers: [
        { provide: RetrievalService, useValue: { retrieve } },
        {
          provide: IdentityVerifier,
          useValue: { verify: jest.fn(() => Promise.resolve(identity)) },
        },
        { provide: APP_GUARD, useClass: TrustedIdentityGuard },
      ],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureHttp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  function post() {
    return request(app.getHttpServer())
      .post('/knowledge/retrieval')
      .set('x-request-id', requestId)
      .set('x-correlation-id', correlationId);
  }

  it('accepts only the verified organization and bounded Knowledge Base scope', async () => {
    const response = await post()
      .send({
        organizationId,
        knowledgeBaseId,
        query: 'compensation reviews',
        topK: 3,
      })
      .expect(201);
    expect(response.body).toMatchObject({
      type: 'knowledge.retrieval.results',
    });
    expect(retrieve).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId, requestId, correlationId }),
      expect.objectContaining({ organizationId, knowledgeBaseId, topK: 3 }),
    );
  });

  it('rejects a cross-tenant body before retrieval receives a query', async () => {
    await post()
      .send({
        organizationId: '00000000-0000-4000-8000-000000000020',
        knowledgeBaseId,
        query: 'compensation reviews',
      })
      .expect(403);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('rejects a Knowledge Base outside the signed resource scope', async () => {
    await post()
      .send({
        organizationId,
        knowledgeBaseId: '00000000-0000-4000-8000-000000000103',
        query: 'compensation reviews',
      })
      .expect(403);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('rejects an unbounded top-K before retrieval runs', async () => {
    await post()
      .send({
        organizationId,
        knowledgeBaseId,
        query: 'compensation reviews',
        topK: 51,
      })
      .expect(400);
    expect(retrieve).not.toHaveBeenCalled();
  });
});
