import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Actor } from '../common/context';
import { DatabaseService } from '../database/database';
import { ResourcePolicy } from '../authorization/resource-policy';
import { ObjectStorage } from '../storage/object-storage';
import type { InitiateUploadDto } from '../common/dto';
import { knowledgeConfig } from '../common/config';
export function validateUploadMetadata(
  input: { mimeType: string; sizeBytes: number },
  storage: { allowedMimeTypes: readonly string[]; maxUploadBytes: number },
) {
  if (!storage.allowedMimeTypes.includes(input.mimeType))
    throw new UnsupportedMediaTypeException();
  if (input.sizeBytes > storage.maxUploadBytes)
    throw new PayloadTooLargeException();
}
@Injectable()
export class UploadsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: ResourcePolicy,
    private readonly storage: ObjectStorage,
  ) {}
  private filename(name: string) {
    return name
      .replace(/[\u0000-\u001f\\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 255);
  }
  async initiate(
    actor: Actor,
    org: string,
    baseId: string,
    dto: InitiateUploadDto,
  ) {
    const member = await this.policy.assert(
      actor,
      org,
      'knowledge_base',
      baseId,
      'ingest',
    );
    const cfg = knowledgeConfig().storage;
    validateUploadMetadata(dto, cfg);
    const filename = this.filename(dto.filename);
    if (!filename) throw new ConflictException();
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          baseId,
          sourceId: dto.sourceId,
          title: dto.title.trim(),
          filename,
          mimeType: dto.mimeType,
          sizeBytes: dto.sizeBytes,
          accessMode: dto.accessMode ?? 'inherit',
        }),
      )
      .digest('hex');
    const intent = await this.database.transaction(async (tx) => {
      const prior = await tx.execute<{
        request_fingerprint: string;
        document_version_id: string;
        storage_key: string;
        mime_type: string;
        size_bytes: number;
        document_id: string;
      }>(
        sql`SELECT i.request_fingerprint,v.id AS document_version_id,v.storage_key,v.mime_type,v.size_bytes,v.document_id FROM knowledge.upload_idempotency i JOIN knowledge.document_versions v ON v.organization_id=i.organization_id AND v.id=i.document_version_id WHERE i.organization_id=${org} AND i.membership_id=${member} AND i.idempotency_key=${dto.idempotencyKey} FOR UPDATE`,
      );
      if (prior.rows[0]) {
        if (prior.rows[0].request_fingerprint !== fingerprint)
          throw new ConflictException();
        return prior.rows[0];
      }
      const source = await tx.execute<{ id: string }>(
        sql`SELECT id FROM knowledge.knowledge_sources WHERE organization_id=${org} AND knowledge_base_id=${baseId} AND id=${dto.sourceId} AND source_kind='manual_upload' AND status='active'`,
      );
      if (!source.rows[0]) throw new NotFoundException();
      const document = await tx.execute<{ id: string }>(
        sql`INSERT INTO knowledge.documents(organization_id,knowledge_base_id,source_id,title,access_mode,created_by_membership_id) VALUES (${org},${baseId},${dto.sourceId},${dto.title.trim()},${dto.accessMode ?? 'inherit'},${member}) RETURNING id`,
      );
      const documentId = document.rows[0]!.id;
      const versionId = randomUUID();
      const key = `knowledge/${org}/${documentId}/${versionId}/original`;
      await tx.execute(
        sql`INSERT INTO knowledge.document_versions(id,organization_id,document_id,version,original_filename,mime_type,size_bytes,storage_bucket,storage_key,created_by_membership_id) VALUES (${versionId},${org},${documentId},1,${filename},${dto.mimeType},${dto.sizeBytes},${cfg.bucket},${key},${member})`,
      );
      if (dto.accessMode === 'restricted')
        for (const action of ['read', 'ingest', 'manage'] as const)
          await tx.execute(
            sql`INSERT INTO knowledge.resource_grants(organization_id,resource_type,resource_id,membership_id,action,created_by_membership_id) VALUES(${org},'document',${documentId},${member},${action},${member})`,
          );
      await tx.execute(
        sql`INSERT INTO knowledge.upload_idempotency(organization_id,membership_id,idempotency_key,request_fingerprint,document_version_id) VALUES(${org},${member},${dto.idempotencyKey},${fingerprint},${versionId})`,
      );
      return {
        request_fingerprint: fingerprint,
        document_version_id: versionId,
        storage_key: key,
        mime_type: dto.mimeType,
        size_bytes: dto.sizeBytes,
        document_id: documentId,
      };
    });
    const target = await this.storage.createUploadUrl(
      intent.storage_key,
      intent.mime_type,
      intent.size_bytes,
    );
    return {
      documentId: intent.document_id,
      documentVersionId: intent.document_version_id,
      status: 'awaiting_upload',
      upload: target,
    };
  }
  async finalize(actor: Actor, org: string, versionId: string) {
    const version = await this.database.db.execute<{
      document_id: string;
      storage_key: string;
      mime_type: string;
      size_bytes: number;
      processing_status: string;
      storage_version_id: string | null;
      knowledge_base_id: string;
      source_id: string;
    }>(
      sql`SELECT v.document_id,v.storage_key,v.mime_type,v.size_bytes,v.processing_status,v.storage_version_id,d.knowledge_base_id,d.source_id FROM knowledge.document_versions v JOIN knowledge.documents d ON d.organization_id=v.organization_id AND d.id=v.document_id WHERE v.organization_id=${org} AND v.id=${versionId}`,
    );
    if (!version.rows[0]) throw new NotFoundException();
    const value = version.rows[0];
    const member = await this.policy.assert(
      actor,
      org,
      'document',
      value.document_id,
      'ingest',
    );
    if (value.processing_status !== 'awaiting_upload') {
      if (value.processing_status === 'pending')
        return {
          documentVersionId: versionId,
          status: 'pending',
          idempotent: true,
        };
      throw new ConflictException();
    }
    const object = await this.storage.head(value.storage_key);
    if (
      object.contentType !== value.mime_type ||
      object.contentLength !== value.size_bytes
    )
      throw new ConflictException();
    const checksum = await this.storage.checksum(
      value.storage_key,
      object.versionId,
    );
    return this.database.transaction(async (tx) => {
      const updated = await tx.execute(
        sql`UPDATE knowledge.document_versions SET checksum_sha256=${checksum},storage_version_id=${object.versionId},processing_status='pending',finalized_at=now() WHERE organization_id=${org} AND id=${versionId} AND processing_status='awaiting_upload' RETURNING id`,
      );
      if (!updated.rows[0]) {
        const current = await tx.execute<{ processing_status: string }>(
          sql`SELECT processing_status FROM knowledge.document_versions WHERE organization_id=${org} AND id=${versionId}`,
        );
        if (current.rows[0]?.processing_status === 'pending')
          return {
            documentVersionId: versionId,
            status: 'pending',
            idempotent: true,
          };
        throw new ConflictException();
      }
      await tx.execute(
        sql`INSERT INTO knowledge.ingestion_requests(organization_id,document_version_id,requested_by_membership_id,correlation_id) VALUES(${org},${versionId},${member},${actor.correlationId}) ON CONFLICT(organization_id,document_version_id) DO NOTHING`,
      );
      await tx.execute(
        sql`INSERT INTO knowledge.audit_events(organization_id,actor_membership_id,action,resource_type,resource_id,request_id,correlation_id) VALUES(${org},${member},'document_version.finalized','document_version',${versionId},${actor.requestId},${actor.correlationId})`,
      );
      return {
        documentVersionId: versionId,
        status: 'pending',
        checksum: { algorithm: 'sha256', value: checksum },
      };
    });
  }
}
