import { NestFactory } from '@nestjs/core';
import { existsSync } from 'node:fs';
import { AppModule } from './app.module';

async function bootstrap() {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }

  const port = Number(process.env.PORT ?? 4105);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const app = await NestFactory.create(AppModule);
  await app.listen(port, process.env.HOST ?? '127.0.0.1');
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
