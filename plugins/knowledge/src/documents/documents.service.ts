import { Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Actor } from '../common/context';
import { DatabaseService } from '../database/database';
import { ResourcePolicy } from '../authorization/resource-policy';
@Injectable()
export class DocumentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: ResourcePolicy,
  ) {}
  async list(actor: Actor, org: string, base: string, limit: number) {
    const membership = await this.policy.assert(
      actor,
      org,
      'knowledge_base',
      base,
      'read',
    );
    return (
      await this.db.db.execute(
        sql`SELECT id,title,status,access_mode AS "accessMode",created_at AS "createdAt",updated_at AS "updatedAt" FROM knowledge.documents d WHERE organization_id=${org} AND knowledge_base_id=${base} AND status='active' AND (access_mode='inherit' OR EXISTS(SELECT 1 FROM knowledge.resource_grants g WHERE g.organization_id=d.organization_id AND g.resource_type='document' AND g.resource_id=d.id AND g.membership_id=${membership} AND g.action='read')) ORDER BY created_at DESC LIMIT ${limit}`,
      )
    ).rows;
  }
  async get(actor: Actor, org: string, id: string) {
    await this.policy.assert(actor, org, 'document', id, 'read');
    const r = await this.db.db.execute(
      sql`SELECT id,knowledge_base_id AS "knowledgeBaseId",source_id AS "sourceId",title,status,access_mode AS "accessMode",created_at AS "createdAt" FROM knowledge.documents WHERE organization_id=${org} AND id=${id} AND status='active'`,
    );
    if (!r.rows[0]) throw new NotFoundException();
    return r.rows[0];
  }
  async versions(actor: Actor, org: string, id: string) {
    await this.policy.assert(actor, org, 'document', id, 'read');
    return (
      await this.db.db.execute(
        sql`SELECT id,version,original_filename AS "originalFilename",mime_type AS "mimeType",size_bytes AS "sizeBytes",checksum_sha256 AS "checksumSha256",processing_status AS "processingStatus",created_at AS "createdAt" FROM knowledge.document_versions WHERE organization_id=${org} AND document_id=${id} ORDER BY version DESC`,
      )
    ).rows;
  }
  async archive(actor: Actor, org: string, id: string) {
    await this.policy.assert(actor, org, 'document', id, 'manage');
    const r = await this.db.db.execute(
      sql`UPDATE knowledge.documents SET status='archived',updated_at=now() WHERE organization_id=${org} AND id=${id} AND status='active' RETURNING id,status`,
    );
    if (!r.rows[0]) throw new NotFoundException();
    return r.rows[0];
  }
}
