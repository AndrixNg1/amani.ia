import { createHash } from 'node:crypto';
import type {
  KnowledgeDocumentIngestionRequestedV1,
  KnowledgeDocumentProcessingBatchV1,
  KnowledgeDocumentProcessingStartV1,
} from '@amani/contracts';
import { CHUNKING_VERSION, chunkDocument } from './chunking.js';
import type { workerConfig } from './config.js';
import {
  DeterministicTestEmbeddingProvider,
  OpenAiCompatibleEmbeddingProvider,
} from './embedding.js';
import { ProcessingError, processingFailure } from './errors.js';
import { extractDocument } from './extraction.js';
import { KnowledgeClient } from './knowledge-client.js';
import { NORMALIZATION_VERSION, normalizeDocument } from './normalization.js';

type Config = ReturnType<typeof workerConfig>;

async function download(
  url: string,
  expectedSize: number,
  expectedChecksum: string,
  maxSize: number,
  timeoutMs: number,
) {
  if (expectedSize > maxSize) throw new ProcessingError('FILE_TOO_LARGE');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (response.status === 404) throw new ProcessingError('OBJECT_NOT_FOUND');
    if (!response.ok) throw new ProcessingError('OBJECT_NOT_FOUND');
    const contentLength = Number(response.headers.get('content-length'));
    if (!Number.isSafeInteger(contentLength) || contentLength !== expectedSize)
      throw new ProcessingError('CHECKSUM_MISMATCH');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== expectedSize || bytes.length > maxSize)
      throw new ProcessingError('CHECKSUM_MISMATCH');
    if (createHash('sha256').update(bytes).digest('hex') !== expectedChecksum)
      throw new ProcessingError('CHECKSUM_MISMATCH');
    return bytes;
  } finally {
    clearTimeout(timer);
  }
}

function provider(config: Config) {
  if (config.embedding.provider === 'deterministic-test')
    return new DeterministicTestEmbeddingProvider(
      config.embedding.model,
      config.embedding.dimension,
      config.embedding.configVersion,
    );
  return new OpenAiCompatibleEmbeddingProvider(
    config.embedding.model,
    config.embedding.dimension,
    config.embedding.configVersion,
    config.embedding.baseUrl,
    config.embedding.apiKey,
    config.embedding.timeoutMs,
  );
}

export class DocumentProcessor {
  private readonly client: KnowledgeClient;
  constructor(private readonly config: Config) {
    this.client = new KnowledgeClient(config.knowledge);
  }

  async process(
    job: KnowledgeDocumentIngestionRequestedV1,
    attempt: number,
    maxAttempts: number,
  ) {
    try {
      if (job.job.expiresAt && Date.parse(job.job.expiresAt) <= Date.now())
        throw new ProcessingError('DOCUMENT_VERSION_STALE');
      const embeddings = provider(this.config);
      const start: KnowledgeDocumentProcessingStartV1 = {
        type: 'knowledge.document.processing.start',
        version: 1,
        job,
        normalizationVersion: NORMALIZATION_VERSION,
        chunkingVersion: CHUNKING_VERSION,
        chunkSize: this.config.limits.chunkSize,
        chunkOverlap: this.config.limits.chunkOverlap,
        embeddingProvider: embeddings.provider,
        embeddingModel: embeddings.model,
        embeddingDimension: embeddings.dimension,
        embeddingConfigVersion: embeddings.configVersion,
      };
      const input = await this.client.start(start);
      const bytes = await download(
        input.download.url,
        input.size,
        input.checksum.value,
        this.config.limits.maxOriginalBytes,
        this.config.worker.timeoutMs,
      );
      const extracted = await extractDocument(bytes, input.mimeType, this.config.limits);
      const normalized = normalizeDocument(
        extracted.text,
        this.config.limits.maxExtractedCharacters,
      );
      const chunks = chunkDocument(normalized, this.config.limits);
      for (let offset = 0; offset < chunks.length; offset += this.config.limits.embeddingBatchSize) {
        const batch = chunks.slice(offset, offset + this.config.limits.embeddingBatchSize);
        const vectors = await embeddings.embed(batch.map((chunk) => chunk.content));
        if (vectors.length !== batch.length)
          throw new ProcessingError('EMBEDDING_PROVIDER_INVALID_RESPONSE');
        const body: KnowledgeDocumentProcessingBatchV1 = {
          type: 'knowledge.document.processing.batch',
          version: 1,
          jobId: job.job.jobId,
          organizationId: job.organizationId,
          documentVersionId: job.documentVersionId,
          normalizationVersion: NORMALIZATION_VERSION,
          chunkingVersion: CHUNKING_VERSION,
          chunks: batch.map((chunk, index) => ({
            ...chunk,
            ...(extracted.pageCount === 1 ? { pageNumber: 1 } : {}),
            embedding: vectors[index],
            embeddingProvider: embeddings.provider,
            embeddingModel: embeddings.model,
            embeddingDimension: embeddings.dimension,
            embeddingConfigVersion: embeddings.configVersion,
          })),
        };
        await this.client.publish(job, body);
      }
      await this.client.complete(job, {
        type: 'knowledge.document.processing.completed',
        version: 1,
        jobId: job.job.jobId,
        organizationId: job.organizationId,
        documentVersionId: job.documentVersionId,
        expectedChunkCount: chunks.length,
      });
    } catch (error) {
      const code = processingFailure(error);
      if (
        attempt >= maxAttempts ||
        code === 'AUTHORIZATION_REVOKED' ||
        code === 'DOCUMENT_VERSION_STALE'
      ) {
        try {
          await this.client.fail(job, {
            type: 'knowledge.document.processing.failed',
            version: 1,
            jobId: job.job.jobId,
            organizationId: job.organizationId,
            documentVersionId: job.documentVersionId,
            code,
          });
        } catch {
          // Queue retry is responsible for recovery; never log document data or URLs.
        }
      }
      throw error;
    }
  }
}
