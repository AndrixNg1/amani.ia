import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from './../src/app.controller';
import { AppService } from './../src/app.service';
import { DatabaseService } from './../src/database/database';
import { ObjectStorage } from './../src/storage/object-storage';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: DatabaseService, useValue: { ready: jest.fn() } },
        { provide: ObjectStorage, useValue: { assertReady: jest.fn() } },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health (GET) reports service liveness', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', service: '@amani/data-analytics' });
  });

  it('/health/ready (GET) reports checked internal dependencies', () => {
    return request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect({
        status: 'ok',
        service: '@amani/data-analytics',
        database: 'ready',
        storage: 'ready',
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
