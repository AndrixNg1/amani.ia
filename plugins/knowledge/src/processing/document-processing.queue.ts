import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import { sql } from 'drizzle-orm';
import type { KnowledgeDocumentIngestionRequestedV1 } from '@amani/contracts';
import type {
  CorrelationId,
  JobId,
  OrganizationId,
  ResourceId,
  UserId,
} from '@amani/types';
import { DatabaseService } from '../database/database';
import { knowledgeConfig } from '../common/config';

type PendingJob = {
  job_id: string;
  organization_id: string;
  document_version_id: string;
  document_id: string;
  knowledge_base_id: string;
  source_id: string;
  source_kind: 'manual_upload' | 'connector';
  provider: string | null;
  external_reference: string | null;
  storage_bucket: string;
  storage_key: string;
  storage_version_id: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string;
  requested_by_user_id: string;
  correlation_id: string;
  created_at: Date;
};

@Injectable()
export class DocumentProcessingQueue implements OnApplicationShutdown {
  private readonly config = knowledgeConfig().processingQueue;
  private readonly queue = new Queue<KnowledgeDocumentIngestionRequestedV1>(
    this.config.name,
    {
      prefix: this.config.prefix,
      connection: {
        host: this.config.redisHost,
        port: this.config.redisPort,
        password: this.config.redisPassword,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 500 },
      },
    },
  );
  constructor(private readonly database: DatabaseService) {}

  async publishForVersion(organizationId: string, documentVersionId: string) {
    const result = await this.database.db.execute<PendingJob>(sql`
      SELECT o.job_id,o.organization_id,o.document_version_id,v.document_id,
        d.knowledge_base_id,d.source_id,s.source_kind,s.provider,s.external_reference,
        v.storage_bucket,v.storage_key,v.storage_version_id,v.mime_type,v.size_bytes,
        v.checksum_sha256,o.requested_by_user_id,o.correlation_id,o.created_at
      FROM knowledge.document_processing_outbox o
      JOIN knowledge.document_versions v
        ON v.organization_id=o.organization_id AND v.id=o.document_version_id
      JOIN knowledge.documents d ON d.organization_id=v.organization_id AND d.id=v.document_id
      JOIN knowledge.knowledge_sources s
        ON s.organization_id=d.organization_id AND s.id=d.source_id
      WHERE o.organization_id=${organizationId} AND o.document_version_id=${documentVersionId}
        AND o.status='pending'
    `);
    const row = result.rows[0];
    if (!row) return;
    if (!row.storage_version_id || !row.checksum_sha256)
      throw new ServiceUnavailableException();
    const source = {
      sourceFamily: 'documentary',
      sourceKind: row.source_kind,
      ...(row.provider ? { provider: row.provider } : {}),
      ...(row.external_reference
        ? { externalReference: row.external_reference }
        : {}),
    } as const;
    const job: KnowledgeDocumentIngestionRequestedV1 = {
      type: 'knowledge.document.ingestion.requested',
      version: 1,
      job: {
        jobId: row.job_id as JobId,
        jobType: 'knowledge.document.ingestion',
        jobVersion: 1,
        organizationId: row.organization_id as OrganizationId,
        requestedBy: row.requested_by_user_id as UserId,
        correlationId: row.correlation_id as CorrelationId,
        createdAt: row.created_at.toISOString(),
        attempt: 1,
        owner: '@amani/knowledge',
        resourceId: row.document_version_id as ResourceId,
        resourceVersion: row.checksum_sha256,
        idempotencyKey: row.document_version_id,
        action: 'document.process',
      },
      organizationId: row.organization_id,
      knowledgeBaseId: row.knowledge_base_id,
      sourceId: row.source_id,
      documentId: row.document_id,
      documentVersionId: row.document_version_id,
      source,
      storage: {
        bucket: row.storage_bucket,
        key: row.storage_key,
        versionId: row.storage_version_id,
      },
      mimeType: row.mime_type,
      size: row.size_bytes,
      checksum: { algorithm: 'sha256', value: row.checksum_sha256 },
    };
    try {
      await this.queue.add('ingestion', job, { jobId: row.job_id });
      await this.database.db.execute(sql`
        UPDATE knowledge.document_processing_outbox
        SET status='published',publish_attempts=publish_attempts+1,published_at=now(),updated_at=now()
        WHERE job_id=${row.job_id} AND status='pending'
      `);
    } catch {
      await this.database.db.execute(sql`
        UPDATE knowledge.document_processing_outbox
        SET publish_attempts=publish_attempts+1,updated_at=now()
        WHERE job_id=${row.job_id} AND status='pending'
      `);
      throw new ServiceUnavailableException();
    }
  }

  async onApplicationShutdown() {
    await this.queue.close();
  }
}
