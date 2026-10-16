import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { isUUID } from 'class-validator';
import type {
  KnowledgeDocumentProcessingBatchV1,
  KnowledgeDocumentProcessingCompletionV1,
  KnowledgeDocumentProcessingFailureV1,
  KnowledgeDocumentProcessingInputV1,
  KnowledgeDocumentProcessingStartV1,
  KnowledgeProcessingFailureCode,
} from '@amani/contracts';
import type { Actor, VerifiedIdentity } from '../common/context';
import { DatabaseService } from '../database/database';
import { ResourcePolicy } from '../authorization/resource-policy';
import { ObjectStorage } from '../storage/object-storage';

const failureCodes = new Set<KnowledgeProcessingFailureCode>([
  'AUTHORIZATION_REVOKED',
  'DOCUMENT_VERSION_STALE',
  'UNSUPPORTED_DOCUMENT_TYPE',
  'OBJECT_NOT_FOUND',
  'CHECKSUM_MISMATCH',
  'FILE_TOO_LARGE',
  'NO_EXTRACTABLE_TEXT',
  'EXTRACTION_FAILED',
  'NORMALIZATION_LIMIT_EXCEEDED',
  'TOO_MANY_CHUNKS',
  'EMBEDDING_PROVIDER_UNAVAILABLE',
  'EMBEDDING_PROVIDER_INVALID_RESPONSE',
  'EMBEDDING_DIMENSION_MISMATCH',
  'PROCESSING_TIMEOUT',
  'PERSISTENCE_FAILED',
]);

type VersionContext = {
  document_id: string;
  knowledge_base_id: string;
  source_id: string;
  storage_key: string;
  storage_version_id: string | null;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string | null;
  processing_status: string;
  request_id: string;
  requested_by_membership_id: string;
};

function worker(identity: VerifiedIdentity) {
  if (identity.callingService !== '@amani/document-processing')
    throw new ForbiddenException();
}
function validJob(
  job: KnowledgeDocumentProcessingStartV1['job'],
): boolean {
  return (
    job?.type === 'knowledge.document.ingestion.requested' &&
    job.version === 1 &&
    job.job.jobType === 'knowledge.document.ingestion' &&
    job.job.jobVersion === 1 &&
    isUUID(job.job.jobId) &&
    isUUID(job.organizationId) &&
    isUUID(job.documentVersionId) &&
    isUUID(job.documentId) &&
    isUUID(job.knowledgeBaseId) &&
    isUUID(job.sourceId) &&
    isUUID(job.job.requestedBy) &&
    job.checksum.algorithm === 'sha256' &&
    /^[a-f0-9]{64}$/.test(job.checksum.value)
  );
}
function profileIsValid(body: KnowledgeDocumentProcessingStartV1): boolean {
  return (
    Number.isSafeInteger(body.normalizationVersion) &&
    body.normalizationVersion > 0 &&
    Number.isSafeInteger(body.chunkingVersion) &&
    body.chunkingVersion > 0 &&
    Number.isSafeInteger(body.chunkSize) &&
    body.chunkSize > 0 &&
    Number.isSafeInteger(body.chunkOverlap) &&
    body.chunkOverlap >= 0 &&
    body.chunkOverlap < body.chunkSize &&
    typeof body.embeddingProvider === 'string' &&
    body.embeddingProvider.length > 0 &&
    typeof body.embeddingModel === 'string' &&
    body.embeddingModel.length > 0 &&
    Number.isSafeInteger(body.embeddingDimension) &&
    body.embeddingDimension > 0 &&
    Number.isSafeInteger(body.embeddingConfigVersion) &&
    body.embeddingConfigVersion > 0
  );
}
function vectorLiteral(vector: readonly number[]): string {
  if (
    !vector.length ||
    vector.length > 4096 ||
    vector.some((value) => !Number.isFinite(value))
  )
    throw new BadRequestException();
  return `[${vector.join(',')}]`;
}

@Injectable()
export class DocumentProcessingService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: ResourcePolicy,
    private readonly storage: ObjectStorage,
  ) {}

  private async context(organizationId: string, documentVersionId: string) {
    const result = await this.database.db.execute<VersionContext>(sql`
      SELECT v.document_id,d.knowledge_base_id,d.source_id,v.storage_key,v.storage_version_id,
        v.mime_type,v.size_bytes,v.checksum_sha256,v.processing_status,
        i.id AS request_id,i.requested_by_membership_id
      FROM knowledge.document_versions v
      JOIN knowledge.documents d ON d.organization_id=v.organization_id AND d.id=v.document_id
      JOIN knowledge.knowledge_sources s ON s.organization_id=d.organization_id AND s.id=d.source_id
      JOIN knowledge.knowledge_bases b ON b.organization_id=d.organization_id AND b.id=d.knowledge_base_id
      JOIN knowledge.ingestion_requests i ON i.organization_id=v.organization_id AND i.document_version_id=v.id
      WHERE v.organization_id=${organizationId} AND v.id=${documentVersionId}
        AND v.processing_status IN ('pending','processing','ready')
        AND d.status='active' AND s.status='active' AND b.status='active'
    `);
    if (!result.rows[0]) throw new NotFoundException();
    return result.rows[0];
  }

  async start(
    identity: VerifiedIdentity,
    actor: Actor,
    body: KnowledgeDocumentProcessingStartV1,
  ): Promise<KnowledgeDocumentProcessingInputV1> {
    worker(identity);
    if (!validJob(body.job) || !profileIsValid(body)) throw new BadRequestException();
    const job = body.job;
    if (
      actor.userId !== job.job.requestedBy ||
      actor.organizationId !== job.organizationId
    )
      throw new ForbiddenException();
    const context = await this.context(job.organizationId, job.documentVersionId);
    if (
      context.document_id !== job.documentId ||
      context.knowledge_base_id !== job.knowledgeBaseId ||
      context.source_id !== job.sourceId ||
      context.request_id !== job.job.jobId ||
      context.checksum_sha256 !== job.checksum.value
    )
      throw new ConflictException();
    const membershipId = await this.policy.assert(
      actor,
      job.organizationId,
      'document',
      context.document_id,
      'ingest',
    );
    if (membershipId !== context.requested_by_membership_id)
      throw new ForbiddenException();
    if (context.processing_status === 'ready') throw new ConflictException();
    await this.database.transaction(async (tx) => {
      const claimed = await tx.execute<{ id: string }>(sql`
        UPDATE knowledge.document_versions
        SET processing_status='processing'
        WHERE organization_id=${job.organizationId} AND id=${job.documentVersionId}
          AND processing_status='pending'
        RETURNING id
      `);
      if (claimed.rows[0]) {
        await tx.execute(sql`
          UPDATE knowledge.ingestion_requests SET status='processing',updated_at=now()
          WHERE organization_id=${job.organizationId} AND id=${job.job.jobId}
        `);
        await tx.execute(sql`
          INSERT INTO knowledge.document_processing_runs(
            organization_id,document_version_id,ingestion_request_id,job_id,
            normalization_version,chunking_version,chunk_size,chunk_overlap,
            embedding_provider,embedding_model,embedding_dimension,embedding_config_version
          ) VALUES(
            ${job.organizationId},${job.documentVersionId},${job.job.jobId},${job.job.jobId},
            ${body.normalizationVersion},${body.chunkingVersion},${body.chunkSize},${body.chunkOverlap},
            ${body.embeddingProvider},${body.embeddingModel},${body.embeddingDimension},${body.embeddingConfigVersion}
          )
        `);
        return;
      }
      const run = await tx.execute<{ job_id: string; status: string }>(sql`
        SELECT job_id,status FROM knowledge.document_processing_runs
        WHERE organization_id=${job.organizationId} AND document_version_id=${job.documentVersionId}
        FOR UPDATE
      `);
      if (run.rows[0]?.job_id !== job.job.jobId || run.rows[0].status !== 'processing')
        throw new ConflictException();
    });
    if (!context.storage_version_id || !context.checksum_sha256)
      throw new ConflictException();
    const download = await this.storage.createDownloadUrl(
      context.storage_key,
      context.storage_version_id,
    );
    return {
      type: 'knowledge.document.processing.input',
      version: 1,
      job: job.job,
      organizationId: job.organizationId,
      knowledgeBaseId: job.knowledgeBaseId,
      sourceId: job.sourceId,
      documentId: job.documentId,
      documentVersionId: job.documentVersionId,
      mimeType: context.mime_type,
      size: context.size_bytes,
      checksum: { algorithm: 'sha256', value: context.checksum_sha256 },
      download,
    };
  }

  async publishBatch(
    identity: VerifiedIdentity,
    actor: Actor,
    body: KnowledgeDocumentProcessingBatchV1,
  ) {
    worker(identity);
    if (
      body?.type !== 'knowledge.document.processing.batch' ||
      body.version !== 1 ||
      !isUUID(body.organizationId) ||
      !isUUID(body.documentVersionId) ||
      !isUUID(body.jobId) ||
      !Array.isArray(body.chunks) ||
      body.chunks.length === 0 ||
      body.chunks.length > 100
    )
      throw new BadRequestException();
    const context = await this.context(body.organizationId, body.documentVersionId);
    const membershipId = await this.policy.assert(
      actor,
      body.organizationId,
      'document',
      context.document_id,
      'ingest',
    );
    if (
      actor.organizationId !== body.organizationId ||
      membershipId !== context.requested_by_membership_id ||
      context.request_id !== body.jobId ||
      context.processing_status !== 'processing'
    )
      throw new ForbiddenException();
    await this.database.transaction(async (tx) => {
      for (const chunk of body.chunks) {
        if (
          !Number.isSafeInteger(chunk.chunkIndex) ||
          chunk.chunkIndex < 0 ||
          !chunk.content ||
          !/^[a-f0-9]{64}$/.test(chunk.contentChecksum) ||
          chunk.embedding.length !== chunk.embeddingDimension ||
          !Number.isSafeInteger(chunk.embeddingConfigVersion) ||
          chunk.embeddingConfigVersion < 1
        )
          throw new BadRequestException();
        await tx.execute(sql`
          INSERT INTO knowledge.document_chunks(
            organization_id,knowledge_base_id,source_id,document_id,document_version_id,
            chunk_index,content,content_checksum,section_reference,page_number,embedding,
            embedding_provider,embedding_model,embedding_dimension,embedding_config_version
          ) VALUES(
            ${body.organizationId},${context.knowledge_base_id},${context.source_id},${context.document_id},${body.documentVersionId},
            ${chunk.chunkIndex},${chunk.content},${chunk.contentChecksum},${chunk.sectionReference ?? null},${chunk.pageNumber ?? null},
            ${vectorLiteral(chunk.embedding)}::extensions.vector,${chunk.embeddingProvider},${chunk.embeddingModel},${chunk.embeddingDimension},${chunk.embeddingConfigVersion}
          ) ON CONFLICT (organization_id,document_version_id,chunk_index) DO NOTHING
        `);
        const existing = await tx.execute<{ content_checksum: string }>(sql`
          SELECT content_checksum FROM knowledge.document_chunks
          WHERE organization_id=${body.organizationId} AND document_version_id=${body.documentVersionId}
            AND chunk_index=${chunk.chunkIndex}
        `);
        if (existing.rows[0]?.content_checksum !== chunk.contentChecksum)
          throw new ConflictException();
      }
      const count = await tx.execute<{ count: number }>(sql`
        SELECT count(*)::integer AS count FROM knowledge.document_chunks
        WHERE organization_id=${body.organizationId} AND document_version_id=${body.documentVersionId}
      `);
      await tx.execute(sql`
        UPDATE knowledge.document_processing_runs SET persisted_chunk_count=${count.rows[0].count},updated_at=now()
        WHERE organization_id=${body.organizationId} AND job_id=${body.jobId} AND status='processing'
      `);
    });
    return { accepted: body.chunks.length };
  }

  async complete(
    identity: VerifiedIdentity,
    actor: Actor,
    body: KnowledgeDocumentProcessingCompletionV1,
  ) {
    worker(identity);
    if (
      body?.type !== 'knowledge.document.processing.completed' ||
      body.version !== 1 ||
      !isUUID(body.organizationId) ||
      !isUUID(body.documentVersionId) ||
      !isUUID(body.jobId) ||
      !Number.isSafeInteger(body.expectedChunkCount) ||
      body.expectedChunkCount < 1
    )
      throw new BadRequestException();
    const context = await this.context(body.organizationId, body.documentVersionId);
    const membershipId = await this.policy.assert(
      actor,
      body.organizationId,
      'document',
      context.document_id,
      'ingest',
    );
    if (
      actor.organizationId !== body.organizationId ||
      membershipId !== context.requested_by_membership_id ||
      context.request_id !== body.jobId
    )
      throw new ForbiddenException();
    return this.database.transaction(async (tx) => {
      const count = await tx.execute<{ count: number }>(sql`
        SELECT count(*)::integer AS count FROM knowledge.document_chunks
        WHERE organization_id=${body.organizationId} AND document_version_id=${body.documentVersionId}
      `);
      const run = await tx.execute<{ status: string; persisted_chunk_count: number }>(sql`
        SELECT status,persisted_chunk_count FROM knowledge.document_processing_runs
        WHERE organization_id=${body.organizationId} AND job_id=${body.jobId} FOR UPDATE
      `);
      if (context.processing_status === 'ready' && run.rows[0]?.status === 'completed')
        return { status: 'ready', idempotent: true };
      if (
        context.processing_status !== 'processing' ||
        run.rows[0]?.status !== 'processing' ||
        count.rows[0].count !== body.expectedChunkCount
      )
        throw new ConflictException();
      await tx.execute(sql`
        UPDATE knowledge.document_processing_runs
        SET expected_chunk_count=${body.expectedChunkCount},persisted_chunk_count=${count.rows[0].count},status='completed',completed_at=now(),updated_at=now()
        WHERE organization_id=${body.organizationId} AND job_id=${body.jobId}
      `);
      await tx.execute(sql`
        UPDATE knowledge.ingestion_requests SET status='completed',updated_at=now()
        WHERE organization_id=${body.organizationId} AND id=${body.jobId}
      `);
      await tx.execute(sql`
        UPDATE knowledge.document_versions SET processing_status='ready'
        WHERE organization_id=${body.organizationId} AND id=${body.documentVersionId} AND processing_status='processing'
      `);
      return { status: 'ready', idempotent: false };
    });
  }

  async fail(
    identity: VerifiedIdentity,
    body: KnowledgeDocumentProcessingFailureV1,
  ) {
    worker(identity);
    if (
      body?.type !== 'knowledge.document.processing.failed' ||
      body.version !== 1 ||
      !isUUID(body.organizationId) ||
      !isUUID(body.documentVersionId) ||
      !isUUID(body.jobId) ||
      !failureCodes.has(body.code)
    )
      throw new BadRequestException();
    return this.database.transaction(async (tx) => {
      const request = await tx.execute<{ id: string }>(sql`
        SELECT id FROM knowledge.ingestion_requests
        WHERE organization_id=${body.organizationId} AND id=${body.jobId}
          AND document_version_id=${body.documentVersionId} FOR UPDATE
      `);
      if (!request.rows[0]) throw new NotFoundException();
      await tx.execute(sql`
        UPDATE knowledge.document_processing_runs
        SET status='failed',failure_code=${body.code},failure_message_safe=${body.code},updated_at=now()
        WHERE organization_id=${body.organizationId} AND job_id=${body.jobId} AND status='processing'
      `);
      await tx.execute(sql`
        UPDATE knowledge.ingestion_requests SET status='failed',updated_at=now()
        WHERE organization_id=${body.organizationId} AND id=${body.jobId} AND status IN ('pending','processing')
      `);
      await tx.execute(sql`
        UPDATE knowledge.document_versions SET processing_status='failed'
        WHERE organization_id=${body.organizationId} AND id=${body.documentVersionId}
          AND processing_status IN ('pending','processing')
      `);
      return { status: 'failed', code: body.code };
    });
  }
}
