import { Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Actor } from '../common/context';
import { DatabaseService } from '../database/database';
import { ResourcePolicy } from '../authorization/resource-policy';
@Injectable()
export class VersionsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: ResourcePolicy,
  ) {}
  async list(actor: Actor, organizationId: string, datasetId: string) {
    await this.policy.assert(
      actor,
      organizationId,
      'dataset',
      datasetId,
      'read',
    );
    return (
      await this.database.db.execute(sql`
      SELECT id,version,original_filename AS "originalFilename",mime_type AS "mimeType",size_bytes AS "sizeBytes",checksum_sha256 AS "checksumSha256",import_status AS "importStatus",created_at AS "createdAt"
      FROM data_analytics.dataset_versions WHERE organization_id=${organizationId} AND dataset_id=${datasetId} ORDER BY version DESC`)
    ).rows;
  }
  async get(
    actor: Actor,
    organizationId: string,
    datasetId: string,
    id: string,
  ) {
    await this.policy.assert(
      actor,
      organizationId,
      'dataset',
      datasetId,
      'read',
    );
    const result = await this.database.db.execute(sql`
      SELECT id,version,original_filename AS "originalFilename",mime_type AS "mimeType",size_bytes AS "sizeBytes",checksum_sha256 AS "checksumSha256",import_status AS "importStatus",created_at AS "createdAt"
      FROM data_analytics.dataset_versions WHERE organization_id=${organizationId} AND dataset_id=${datasetId} AND id=${id}`);
    if (!result.rows[0]) throw new NotFoundException();
    return result.rows[0];
  }
}
