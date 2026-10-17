import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseService } from './database/database';
import { ObjectStorage } from './storage/object-storage';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: DatabaseService, useValue: { ready: jest.fn() } },
        { provide: ObjectStorage, useValue: { assertReady: jest.fn() } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  it('reports readiness only after database and private storage checks', async () => {
    await expect(appController.getReadiness()).resolves.toEqual({
      status: 'ok', service: '@amani/data-analytics', database: 'ready', storage: 'ready',
    });
  });
});
