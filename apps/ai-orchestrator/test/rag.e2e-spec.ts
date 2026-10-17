import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Knowledge RAG HTTP boundary (e2e)', () => {
  let app: INestApplication<App>;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  it('rejects an unsigned RAG request before any downstream call', async () => {
    await request(app.getHttpServer())
      .post('/ai/knowledge-rag')
      .send({
        organizationId: '00000000-0000-4000-8000-000000000010',
        question: 'How are annual compensation reviews handled?',
      })
      .expect(403);
  });

  afterEach(async () => {
    await app.close();
  });
});
