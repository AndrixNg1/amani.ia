import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { ConfigurationError, createEnv } from '@amani/config';
import type { EnvironmentSource } from '@amani/config';

const localHost = (host: string) =>
  ['127.0.0.1', '::1', 'localhost'].includes(host);

export function loadLocalEnvironment() {
  if (!existsSync('.env')) return;
  for (const [key, value] of Object.entries(
    parseEnv(readFileSync('.env', 'utf8')),
  )) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function serviceUrl(
  env: ReturnType<typeof createEnv>,
  name: string,
  fallback: string,
  production: boolean,
): string {
  const value = env.url(name, { default: fallback });
  const parsed = new URL(value);
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== '/' ||
    (production && parsed.protocol !== 'https:')
  ) {
    throw new ConfigurationError(name, 'invalid_url');
  }
  return parsed.origin;
}

function localSecret(env: ReturnType<typeof createEnv>, name: string): string {
  const value = env.required(name);
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new ConfigurationError(name, 'invalid_string');
  }
  return value;
}

export function orchestratorConfig(source: EnvironmentSource = process.env) {
  const env = createEnv(source);
  const nodeEnvironment = env.environment('NODE_ENV', {
    default: 'development',
  });
  const environment = env.environment('APP_ENV', { default: nodeEnvironment });
  const production = [nodeEnvironment, environment].some((value) =>
    ['production', 'staging'].includes(value),
  );
  const host = source.HOST === undefined ? '127.0.0.1' : env.required('HOST');
  const authMode = source.ORCHESTRATOR_SERVICE_AUTH_MODE ?? 'disabled';
  if (!['disabled', 'development'].includes(authMode)) {
    throw new ConfigurationError(
      'ORCHESTRATOR_SERVICE_AUTH_MODE',
      'invalid_string',
    );
  }
  if (
    authMode === 'development' &&
    (production ||
      !['development', 'test'].includes(nodeEnvironment) ||
      !localHost(host))
  ) {
    throw new ConfigurationError(
      'ORCHESTRATOR_SERVICE_AUTH_MODE',
      'invalid_environment',
    );
  }
  const generationProvider =
    source.ORCHESTRATOR_GENERATION_PROVIDER ?? 'deterministic-test';
  if (
    !['openai-compatible', 'deterministic-test'].includes(generationProvider)
  ) {
    throw new ConfigurationError(
      'ORCHESTRATOR_GENERATION_PROVIDER',
      'invalid_string',
    );
  }
  if (
    generationProvider === 'deterministic-test' &&
    !['development', 'test'].includes(environment)
  ) {
    throw new ConfigurationError(
      'ORCHESTRATOR_GENERATION_PROVIDER',
      'invalid_environment',
    );
  }
  const defaultTopK = env.integer('ORCHESTRATOR_RAG_DEFAULT_TOP_K', {
    default: 6,
    min: 1,
    max: 20,
  });
  const maxTopK = env.integer('ORCHESTRATOR_RAG_MAX_TOP_K', {
    default: 8,
    min: 1,
    max: 20,
  });
  if (defaultTopK > maxTopK) {
    throw new ConfigurationError(
      'ORCHESTRATOR_RAG_DEFAULT_TOP_K',
      'out_of_range',
    );
  }
  const maxEvidenceChunks = env.integer(
    'ORCHESTRATOR_RAG_MAX_EVIDENCE_CHUNKS',
    {
      default: 6,
      min: 1,
      max: 20,
    },
  );
  if (maxEvidenceChunks > maxTopK) {
    throw new ConfigurationError(
      'ORCHESTRATOR_RAG_MAX_EVIDENCE_CHUNKS',
      'out_of_range',
    );
  }
  const gatewaySecret =
    authMode === 'development'
      ? localSecret(env, 'ORCHESTRATOR_GATEWAY_DEVELOPMENT_SECRET')
      : undefined;
  const coreSecret =
    authMode === 'development'
      ? localSecret(env, 'ORCHESTRATOR_CORE_DEVELOPMENT_SECRET')
      : undefined;
  const knowledgeSecret =
    authMode === 'development'
      ? localSecret(env, 'ORCHESTRATOR_KNOWLEDGE_DEVELOPMENT_SECRET')
      : undefined;
  if (
    gatewaySecret &&
    coreSecret &&
    knowledgeSecret &&
    new Set([gatewaySecret, coreSecret, knowledgeSecret]).size !== 3
  ) {
    throw new ConfigurationError(
      'ORCHESTRATOR_GATEWAY_DEVELOPMENT_SECRET',
      'invalid_string',
    );
  }
  return {
    service: '@amani/ai-orchestrator' as const,
    environment,
    host,
    port: env.integer('PORT', { default: 4002, min: 1, max: 65535 }),
    authMode,
    gatewaySecret,
    coreSecret,
    knowledgeSecret,
    coreUrl: serviceUrl(
      env,
      'CORE_API_URL',
      'http://127.0.0.1:4001',
      production,
    ),
    knowledgeUrl: serviceUrl(
      env,
      'KNOWLEDGE_API_URL',
      'http://127.0.0.1:4101',
      production,
    ),
    coreTimeoutMs: env.integer('ORCHESTRATOR_CORE_TIMEOUT_MS', {
      default: 3000,
      min: 100,
      max: 30000,
    }),
    knowledgeTimeoutMs: env.integer('ORCHESTRATOR_KNOWLEDGE_TIMEOUT_MS', {
      default: 5000,
      min: 100,
      max: 30000,
    }),
    rag: {
      defaultTopK,
      maxTopK,
      minSimilarityBps: env.integer('ORCHESTRATOR_RAG_MIN_SIMILARITY_BPS', {
        default: 0,
        min: 0,
        max: 10000,
      }),
      maxEvidenceChunks,
      maxEvidenceCharacters: env.integer(
        'ORCHESTRATOR_RAG_MAX_EVIDENCE_CHARACTERS',
        { default: 12000, min: 256, max: 100000 },
      ),
    },
    generation: {
      provider: generationProvider as
        'openai-compatible' | 'deterministic-test',
      model:
        generationProvider === 'deterministic-test'
          ? (source.ORCHESTRATOR_GENERATION_MODEL ?? 'deterministic-v1')
          : env.required('ORCHESTRATOR_GENERATION_MODEL'),
      timeoutMs: env.integer('ORCHESTRATOR_GENERATION_TIMEOUT_MS', {
        default: 30000,
        min: 100,
        max: 120000,
      }),
      maxOutputTokens: env.integer(
        'ORCHESTRATOR_GENERATION_MAX_OUTPUT_TOKENS',
        {
          default: 700,
          min: 32,
          max: 4000,
        },
      ),
      temperatureBps: env.integer('ORCHESTRATOR_GENERATION_TEMPERATURE_BPS', {
        default: 1000,
        min: 0,
        max: 20000,
      }),
      ...(generationProvider === 'openai-compatible'
        ? {
            baseUrl: env.url('ORCHESTRATOR_GENERATION_BASE_URL'),
            apiKey: env.required('ORCHESTRATOR_GENERATION_API_KEY'),
          }
        : {}),
    },
  };
}

export type OrchestratorConfig = ReturnType<typeof orchestratorConfig>;
