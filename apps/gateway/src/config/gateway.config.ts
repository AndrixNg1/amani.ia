import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createEnv, ConfigurationError } from '@amani/config';
import type { EnvironmentSource } from '@amani/config';
import { isUUID } from 'class-validator';
import type { UserId } from '@amani/types';

export const GATEWAY_CONFIG = Symbol('GATEWAY_CONFIG');
const local = (host: string) =>
  ['127.0.0.1', '::1', '[::1]', 'localhost'].includes(host);
export function loadLocalEnvironment() {
  if (!existsSync('.env')) return;
  for (const [key, value] of Object.entries(
    parseEnv(readFileSync('.env', 'utf8')),
  )) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
export function gatewayConfig(source: EnvironmentSource = process.env) {
  const env = createEnv(source);
  const nodeEnvironment = env.environment('NODE_ENV', {
    default: 'development',
  });
  const environment = env.environment('APP_ENV', { default: nodeEnvironment });
  const production = [nodeEnvironment, environment].some((e) =>
    ['production', 'staging'].includes(e),
  );
  const host =
    source.GATEWAY_HOST === undefined
      ? (source.HOST ?? '127.0.0.1')
      : env.required('GATEWAY_HOST');
  const port = createEnv({
    ...source,
    GATEWAY_PORT: source.GATEWAY_PORT ?? source.PORT,
  }).integer('GATEWAY_PORT', { default: 4000, min: 1, max: 65535 });
  const coreUrl = new URL(
    env.url('CORE_API_BASE_URL', { default: 'http://127.0.0.1:4001' }),
  );
  if (
    coreUrl.username ||
    coreUrl.password ||
    coreUrl.search ||
    coreUrl.hash ||
    coreUrl.pathname !== '/' ||
    (production && coreUrl.protocol !== 'https:')
  ) {
    throw new ConfigurationError('CORE_API_BASE_URL', 'invalid_url');
  }
  const authMode = source.GATEWAY_AUTH_MODE ?? 'disabled';
  const serviceMode = source.GATEWAY_SERVICE_AUTH_MODE ?? 'disabled';
  for (const [key, mode] of [
    ['GATEWAY_AUTH_MODE', authMode],
    ['GATEWAY_SERVICE_AUTH_MODE', serviceMode],
  ]) {
    if (!['disabled', 'development'].includes(mode))
      throw new ConfigurationError(key, 'invalid_string');
    if (
      mode === 'development' &&
      (production ||
        !['development', 'test'].includes(source.NODE_ENV ?? '') ||
        !local(host) ||
        !local(coreUrl.hostname))
    ) {
      throw new ConfigurationError(key, 'invalid_environment');
    }
  }
  const secret = (key: string) => {
    const value = env.required(key);
    if (!/^[a-f0-9]{64}$/.test(value))
      throw new ConfigurationError(key, 'invalid_string');
    return value;
  };
  const devToken =
    authMode === 'development' ? secret('GATEWAY_DEV_BEARER_TOKEN') : undefined;
  const serviceSecret =
    serviceMode === 'development'
      ? secret('DEVELOPMENT_SERVICE_SECRET')
      : undefined;
  const devUserId =
    authMode === 'development'
      ? env.required('GATEWAY_DEV_USER_ID')
      : undefined;
  if (devUserId !== undefined && !isUUID(devUserId))
    throw new ConfigurationError('GATEWAY_DEV_USER_ID', 'invalid_string');
  if (devToken && devToken === serviceSecret)
    throw new ConfigurationError(
      'DEVELOPMENT_SERVICE_SECRET',
      'invalid_string',
    );
  const origins = (
    source.GATEWAY_ALLOWED_ORIGINS ??
    (production
      ? ''
      : 'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002')
  )
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  for (const origin of origins) {
    const parsed = new URL(createEnv({ ORIGIN: origin }).url('ORIGIN'));
    if (
      origin !== parsed.origin ||
      (production && parsed.protocol !== 'https:')
    )
      throw new ConfigurationError('GATEWAY_ALLOWED_ORIGINS', 'invalid_url');
  }
  return {
    service: '@amani/gateway' as const,
    environment,
    production,
    host,
    port,
    coreBaseUrl: coreUrl.origin,
    coreTimeoutMs: env.integer('CORE_API_TIMEOUT_MS', {
      default: 3000,
      min: 10,
      max: 30000,
    }),
    coreMaxResponseBytes: env.integer('CORE_API_MAX_RESPONSE_BYTES', {
      default: 262144,
      min: 256,
      max: 1048576,
    }),
    bodyLimitBytes: env.integer('GATEWAY_BODY_LIMIT_BYTES', {
      default: 65536,
      min: 256,
      max: 1048576,
    }),
    allowedOrigins: origins,
    rateWindowMs: env.integer('GATEWAY_RATE_WINDOW_MS', {
      default: 60000,
      min: 100,
      max: 3600000,
    }),
    rateIp: env.integer('GATEWAY_RATE_IP', {
      default: 120,
      min: 1,
      max: 100000,
    }),
    rateUser: env.integer('GATEWAY_RATE_USER', {
      default: 120,
      min: 1,
      max: 100000,
    }),
    rateOrganization: env.integer('GATEWAY_RATE_ORGANIZATION', {
      default: 600,
      min: 1,
      max: 100000,
    }),
    rateMaxKeys: env.integer('GATEWAY_RATE_MAX_KEYS', {
      default: 10000,
      min: 1,
      max: 100000,
    }),
    devToken,
    devUserId: devUserId?.toLowerCase() as UserId | undefined,
    serviceSecret,
  };
}
export type GatewayConfig = ReturnType<typeof gatewayConfig>;
