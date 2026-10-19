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
  if (!values.length || values.some((item) => item.length > 150))
    throw new ConfigurationError(name, 'invalid_string');
  return values;
}

export function analyticsConfig(source: EnvironmentSource = process.env) {
  const env = createEnv(source);
  const environment = env.environment('APP_ENV', { default: 'development' });
  const ssl = env.boolean('DB_SSL', { default: false });
  if (!['development', 'test'].includes(environment) && !ssl)
    throw new ConfigurationError('DB_SSL', 'invalid_boolean');

  const authMode = source.DATA_ANALYTICS_SERVICE_AUTH_MODE ?? 'disabled';
  if (!['disabled', 'development'].includes(authMode))
    throw new ConfigurationError(
      'DATA_ANALYTICS_SERVICE_AUTH_MODE',
      'invalid_string',
    );
  if (
    authMode === 'development' &&
    (!['development', 'test'].includes(environment) ||
      !['127.0.0.1', '::1', 'localhost'].includes(source.HOST ?? '127.0.0.1'))
  )
    throw new ConfigurationError(
      'DATA_ANALYTICS_SERVICE_AUTH_MODE',
      'invalid_environment',
    );

  const secret = (name: string) => {
    const value = env.required(name);
    if (!/^[a-f0-9]{64}$/.test(value))
      throw new ConfigurationError(name, 'invalid_string');
    return value;
  };
  const serviceSecret =
    authMode === 'development'
      ? secret('DATA_ANALYTICS_DEVELOPMENT_SERVICE_SECRET')
      : undefined;
  const coreSecret =
    authMode === 'development'
      ? secret('DATA_ANALYTICS_CORE_DEVELOPMENT_SECRET')
      : undefined;
  if (serviceSecret && serviceSecret === coreSecret)
    throw new ConfigurationError(
      'DATA_ANALYTICS_CORE_DEVELOPMENT_SECRET',
      'invalid_string',
    );

  return {
    service: '@amani/data-analytics' as const,
    environment,
    host: source.HOST === undefined ? '127.0.0.1' : env.required('HOST'),
    port: env.integer('PORT', { default: 4102, min: 1, max: 65535 }),
    authMode,
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
      user: 'amani_data_analytics',
      password: env.required('DATA_ANALYTICS_DB_PASSWORD'),
      ssl: ssl ? { rejectUnauthorized: true } : (false as const),
      max: env.integer('DB_POOL_SIZE', { default: 10, min: 1, max: 30 }),
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10000,
      statement_timeout: 5000,
      application_name: '@amani/data-analytics',
      options: '-c search_path=data_analytics -c lock_timeout=3000',
    },
    storage: {
      endpoint: env.url('DATA_ANALYTICS_STORAGE_ENDPOINT'),
      region: env.required('DATA_ANALYTICS_STORAGE_REGION'),
      bucket: env.required('DATA_ANALYTICS_STORAGE_BUCKET'),
      accessKeyId: env.required('DATA_ANALYTICS_STORAGE_ACCESS_KEY'),
      secretAccessKey: env.required('DATA_ANALYTICS_STORAGE_SECRET_KEY'),
      forcePathStyle: env.boolean('DATA_ANALYTICS_STORAGE_FORCE_PATH_STYLE', {
        default: true,
      }),
      uploadUrlSeconds: env.integer('DATA_ANALYTICS_UPLOAD_URL_SECONDS', {
        default: 300,
        min: 30,
        max: 900,
      }),
      maxCsvBytes: env.integer('DATA_ANALYTICS_MAX_CSV_BYTES', {
        default: 52_428_800,
        min: 1,
        max: 1_073_741_824,
      }),
      maxXlsxBytes: env.integer('DATA_ANALYTICS_MAX_XLSX_BYTES', {
        default: 104_857_600,
        min: 1,
        max: 1_073_741_824,
      }),
      allowedMimeTypes: csv(
        env.required('DATA_ANALYTICS_ALLOWED_MIME_TYPES'),
        'DATA_ANALYTICS_ALLOWED_MIME_TYPES',
      ),
    },
  };
}
