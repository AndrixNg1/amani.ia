import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { coreConfig, loadLocalEnvironment } from './common/config';
import { configureHttp } from './common/http';

async function bootstrap() {
  loadLocalEnvironment();
  const config = coreConfig();
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn'],
    abortOnError: false,
  });
  configureHttp(app);
  app.enableShutdownHooks();
  await app.listen(config.port, config.host);
}

bootstrap().catch(() => {
  console.error('Core startup failed. Check environment and dependencies.');
  process.exitCode = 1;
});
