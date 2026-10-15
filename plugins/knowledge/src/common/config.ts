import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { ConfigurationError, createEnv } from '@amani/config';
import type { EnvironmentSource } from '@amani/config';

export function loadLocalEnvironment() {
  if (!existsSync('.env')) return;
  for (const [key, value] of Object.entries(
    parseEnv(readFileSync('.env', 'utf8')),
  )) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function csv(value: string, name: string): readonly string[] {
  const values = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!values.length || values.some((item) => item.length > 150)) {
    throw new ConfigurationError(name, 'invalid_string');
  }
  return values;
}

export function knowledgeConfig(source: EnvironmentSource = process.env) {
  const env = createEnv(source);
  const environment = env.environment('APP_ENV', { default: 'development' });
  const ssl = env.boolean('DB_SSL', { default: false });
  if (!['development', 'test'].includes(environment) && !ssl) {
    throw new ConfigurationError('DB_SSL', 'invalid_boolean');
  }
  const development = source.KNOWLEDGE_SERVICE_AUTH_MODE ?? 'disabled';
  if (development !== 'disabled' && development !== 'development') {
    throw new ConfigurationError(
      'KNOWLEDGE_SERVICE_AUTH_MODE',
      'invalid_string',
    );
  }
  if (
    development === 'development' &&
    (!['development', 'test'].includes(environment) ||
      !['127.0.0.1', '::1', 'localhost'].includes(source.HOST ?? '127.0.0.1'))
  ) {
    throw new ConfigurationError(
      'KNOWLEDGE_SERVICE_AUTH_MODE',
      'invalid_environment',
    );
  }
  const serviceSecret =
    development === 'development'
      ? env.required('KNOWLEDGE_DEVELOPMENT_SERVICE_SECRET')
      : undefined;
  const coreSecret =
    development === 'development'
      ? env.required('KNOWLEDGE_CORE_DEVELOPMENT_SECRET')
      : undefined;
  if (
    (serviceSecret && !/^[a-f0-9]{64}$/.test(serviceSecret)) ||
    (coreSecret && !/^[a-f0-9]{64}$/.test(coreSecret))
  ) {
    throw new ConfigurationError(
      'KNOWLEDGE_DEVELOPMENT_SERVICE_SECRET',
      'invalid_string',
    );
  }
  return {
    service: '@amani/knowledge' as const,
    environment,
    host: source.HOST === undefined ? '127.0.0.1' : env.required('HOST'),
    port: env.integer('PORT', { default: 4101, min: 1, max: 65535 }),
    authMode: development,
    developmentServiceSecret: serviceSecret,
    coreDevelopmentSecret: coreSecret,
    coreUrl: env.url('CORE_API_URL', { default: 'http://127.0.0.1:4001' }),
    coreTimeoutMs: env.integer('CORE_API_TIMEOUT_MS', {
      default: 3000,
      min: 100,
      max: 10000,
    }),
    database: {
      host: env.required('DB_HOST'),
      port: env.integer('DB_PORT', { default: 5432, min: 1, max: 65535 }),
      database: env.required('DB_NAME'),
      user: 'amani_knowledge',
      password: env.required('KNOWLEDGE_DB_PASSWORD'),
      ssl: ssl ? { rejectUnauthorized: true } : (false as const),
      max: env.integer('DB_POOL_SIZE', { default: 10, min: 1, max: 30 }),
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10000,
      statement_timeout: 5000,
      application_name: '@amani/knowledge',
      options: '-c search_path=knowledge,extensions -c lock_timeout=3000',
    },
    storage: {
      endpoint: env.url('KNOWLEDGE_STORAGE_ENDPOINT'),
      region: env.required('KNOWLEDGE_STORAGE_REGION'),
      bucket: env.required('KNOWLEDGE_STORAGE_BUCKET'),
      accessKeyId: env.required('KNOWLEDGE_STORAGE_ACCESS_KEY'),
      secretAccessKey: env.required('KNOWLEDGE_STORAGE_SECRET_KEY'),
      forcePathStyle: env.boolean('KNOWLEDGE_STORAGE_FORCE_PATH_STYLE', {
        default: true,
      }),
      uploadUrlSeconds: env.integer('KNOWLEDGE_UPLOAD_URL_SECONDS', {
        default: 300,
        min: 30,
        max: 900,
      }),
      maxUploadBytes: env.integer('KNOWLEDGE_MAX_UPLOAD_BYTES', {
        default: 52_428_800,
        min: 1,
        max: 1_073_741_824,
      }),
      allowedMimeTypes: csv(
        env.required('KNOWLEDGE_ALLOWED_MIME_TYPES'),
        'KNOWLEDGE_ALLOWED_MIME_TYPES',
      ),
    },
  };
}
