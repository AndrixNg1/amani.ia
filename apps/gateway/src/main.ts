import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GATEWAY_CONFIG, loadLocalEnvironment } from './config/gateway.config';
import type { GatewayConfig } from './config/gateway.config';
import { configureHttp } from './common/http';

async function bootstrap() {
  loadLocalEnvironment();
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: ['warn'],
    abortOnError: false,
  });
  const config = app.get<GatewayConfig>(GATEWAY_CONFIG);
  configureHttp(app);
  app.enableShutdownHooks();
  await app.listen(config.port, config.host);
}

bootstrap().catch(() => {
  console.error('Gateway startup failed. Check environment and dependencies.');
  process.exitCode = 1;
});
