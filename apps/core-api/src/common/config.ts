import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createEnv, ConfigurationError } from '@amani/config';
import type { EnvironmentSource } from '@amani/config';

export function loadLocalEnvironment() {
  if (!existsSync('.env')) return;
  // Explicit assignment also works with Jest's isolated process.env object.
  for (const [key, value] of Object.entries(
    parseEnv(readFileSync('.env', 'utf8')),
  )) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function coreConfig(source: EnvironmentSource = process.env) {
  const env = createEnv(source);
  const environment = env.environment('APP_ENV', { default: 'development' });
  const host = env.required('DB_HOST');
  const ssl = env.boolean('DB_SSL', { default: false });
  if (environment !== 'development' && environment !== 'test' && !ssl) {
    throw new ConfigurationError('DB_SSL', 'invalid_boolean');
  }
  return {
    service: '@amani/core-api' as const,
    environment,
    host: source.HOST === undefined ? '127.0.0.1' : env.required('HOST'),
    port: env.integer('PORT', { default: 4001, min: 1, max: 65535 }),
    database: {
      host,
      port: env.integer('DB_PORT', { default: 5432, min: 1, max: 65535 }),
      database: env.required('DB_NAME'),
      user: 'amani_core_platform',
      password: env.required('CORE_PLATFORM_DB_PASSWORD'),
      ssl: ssl ? { rejectUnauthorized: true } : (false as const),
      max: env.integer('DB_POOL_SIZE', { default: 10, min: 1, max: 30 }),
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10000,
      statement_timeout: 5000,
      application_name: '@amani/core-api',
      options: '-c search_path=core_platform -c lock_timeout=3000',
    },
  };
}
