import { createHash } from 'node:crypto';
import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { knowledgeConfig } from '../common/config';

export type RetrievalEmbeddingProfile = {
  readonly provider: string;
  readonly model: string;
  readonly dimension: number;
  readonly configVersion: number;
  readonly metric: 'cosine';
};

function validVector(
  value: unknown,
  dimension: number,
): value is readonly number[] {
  return (
    Array.isArray(value) &&
    value.length === dimension &&
    value.every(
      (component) =>
        typeof component === 'number' && Number.isFinite(component),
    )
  );
}

@Injectable()
export class RetrievalEmbeddingProvider {
  private readonly config = knowledgeConfig().retrieval.embedding;

  profile(): RetrievalEmbeddingProfile {
    return {
      provider: this.config.provider,
      model: this.config.model,
      dimension: this.config.dimension,
      configVersion: this.config.configVersion,
      metric: 'cosine',
    };
  }

  async embedQuery(query: string): Promise<readonly number[]> {
    if (this.config.provider === 'deterministic-test') {
      const digest = createHash('sha512').update(query).digest();
      return Array.from(
        { length: this.config.dimension },
        (_, index) => (digest[index % digest.length] - 127.5) / 127.5,
      );
    }
    if (
      this.config.provider !== 'openai-compatible' ||
      !('baseUrl' in this.config) ||
      !('apiKey' in this.config) ||
      typeof this.config.baseUrl !== 'string' ||
      typeof this.config.apiKey !== 'string'
    )
      throw new ServiceUnavailableException();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(
        new URL('embeddings', `${this.config.baseUrl}/`),
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.config.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ model: this.config.model, input: query }),
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new ServiceUnavailableException();
      const body: unknown = await response.json();
      const embedding =
        body && typeof body === 'object' &&
        Array.isArray((body as { data?: unknown }).data)
          ? ((body as { data: unknown[] }).data[0] as { embedding?: unknown })
              ?.embedding
          : undefined;
      if (!validVector(embedding, this.config.dimension))
        throw new BadGatewayException();
      return embedding;
    } catch (error) {
      if (
        error instanceof BadGatewayException ||
        error instanceof ServiceUnavailableException
      )
        throw error;
      if (error instanceof Error && error.name === 'AbortError')
        throw new GatewayTimeoutException();
      throw new ServiceUnavailableException();
    } finally {
      clearTimeout(timer);
    }
  }
}
