import { createHash } from 'node:crypto';
import { ProcessingError } from './errors.js';

export interface EmbeddingProvider {
  readonly provider: string;
  readonly model: string;
  readonly dimension: number;
  readonly configVersion: number;
  embed(texts: readonly string[]): Promise<readonly (readonly number[])[]>;
}

export class DeterministicTestEmbeddingProvider implements EmbeddingProvider {
  readonly provider = 'deterministic-test';
  constructor(
    readonly model: string,
    readonly dimension: number,
    readonly configVersion: number,
  ) {}
  async embed(texts: readonly string[]) {
    return texts.map((text) => {
      const digest = createHash('sha512').update(text).digest();
      return Array.from({ length: this.dimension }, (_, index) =>
        (digest[index % digest.length] - 127.5) / 127.5,
      );
    });
  }
}

export class OpenAiCompatibleEmbeddingProvider implements EmbeddingProvider {
  readonly provider = 'openai-compatible';
  constructor(
    readonly model: string,
    readonly dimension: number,
    readonly configVersion: number,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs: number,
  ) {}
  async embed(texts: readonly string[]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(new URL('embeddings', `${this.baseUrl}/`), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model: this.model, input: texts }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new ProcessingError('EMBEDDING_PROVIDER_UNAVAILABLE');
      const body: unknown = await response.json();
      if (!body || typeof body !== 'object' || !Array.isArray((body as { data?: unknown }).data))
        throw new ProcessingError('EMBEDDING_PROVIDER_INVALID_RESPONSE');
      const vectors = (body as { data: unknown[] }).data.map((item) => {
        const embedding = (item as { embedding?: unknown }).embedding;
        if (!Array.isArray(embedding) || embedding.some((value) => typeof value !== 'number'))
          throw new ProcessingError('EMBEDDING_PROVIDER_INVALID_RESPONSE');
        return embedding;
      });
      if (vectors.length !== texts.length)
        throw new ProcessingError('EMBEDDING_PROVIDER_INVALID_RESPONSE');
      if (vectors.some((vector) => vector.length !== this.dimension))
        throw new ProcessingError('EMBEDDING_DIMENSION_MISMATCH');
      return vectors;
    } catch (error) {
      if (error instanceof ProcessingError) throw error;
      throw new ProcessingError('EMBEDDING_PROVIDER_UNAVAILABLE');
    } finally {
      clearTimeout(timer);
    }
  }
}
