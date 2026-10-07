import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GATEWAY_CONFIG, gatewayConfig } from '../src/config/gateway.config';
import type { EnvironmentSource } from '@amani/config';
import { configureHttp } from '../src/common/http';
export async function gateway(
  source: EnvironmentSource = {},
): Promise<INestApplication<App>> {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(GATEWAY_CONFIG)
    .useValue(gatewayConfig({ NODE_ENV: 'test', ...source }))
    .compile();
  const app = module.createNestApplication<INestApplication<App>>({
    bodyParser: false,
    logger: false,
  });
  configureHttp(app);
  await app.init();
  return app;
}
