import { ConfigurationError } from '@amani/config';
import type { EnvironmentSource } from '@amani/config';
import { orchestratorConfig } from './config';

const local: EnvironmentSource = {
  APP_ENV: 'development',
  NODE_ENV: 'development',
  HOST: '127.0.0.1',
  ORCHESTRATOR_SERVICE_AUTH_MODE: 'development',
  ORCHESTRATOR_GATEWAY_DEVELOPMENT_SECRET: 'a'.repeat(64),
  ORCHESTRATOR_CORE_DEVELOPMENT_SECRET: 'b'.repeat(64),
  ORCHESTRATOR_KNOWLEDGE_DEVELOPMENT_SECRET: 'c'.repeat(64),
};

describe('orchestratorConfig', () => {
  it('accepts distinct local delegation secrets and bounded RAG defaults', () => {
    const config = orchestratorConfig(local);
    expect(config.authMode).toBe('development');
    expect(config.rag.defaultTopK).toBeLessThanOrEqual(config.rag.maxTopK);
  });

  it('rejects deterministic generation outside development and test', () => {
    expect(() =>
      orchestratorConfig({
        ...local,
        APP_ENV: 'production',
        ORCHESTRATOR_SERVICE_AUTH_MODE: 'disabled',
      }),
    ).toThrow(ConfigurationError);
  });

  it('rejects an evidence limit that exceeds retrieval capacity', () => {
    expect(() =>
      orchestratorConfig({
        ...local,
        ORCHESTRATOR_RAG_MAX_TOP_K: '4',
        ORCHESTRATOR_RAG_MAX_EVIDENCE_CHUNKS: '5',
      }),
    ).toThrow(ConfigurationError);
  });
});
