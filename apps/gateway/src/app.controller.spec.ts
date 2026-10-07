import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreClient } from './core-client/core-client';
import { AuthenticationProvider } from './auth/authentication';
import { ServiceAuthentication } from './core-client/service-authentication';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: CoreClient, useValue: {} },
        { provide: AuthenticationProvider, useValue: { configured: false } },
        { provide: ServiceAuthentication, useValue: { configured: false } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('does not report readiness without authentication providers', async () => {
    await expect(appController.ready()).rejects.toMatchObject({ status: 503 });
  });
  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
