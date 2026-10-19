import { Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Actor } from '../common/context';
import { DatabaseService } from '../database/database';
import { ResourcePolicy } from '../authorization/resource-policy';
@Injectable()
export class SchemaMetadataService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: ResourcePolicy,
  ) {}
  async tables(actor: Actor, organizationId: string, datasetId: string) {
    await this.policy.assert(
      actor,
      organizationId,
      'dataset',
      datasetId,
      'read',
    );
    return (
      await this.database.db.execute(sql`
      SELECT id,dataset_version_id AS "datasetVersionId",name,display_name AS "displayName",ordinal,row_count AS "rowCount",metadata_status AS "metadataStatus"
      FROM data_analytics.dataset_tables WHERE organization_id=${organizationId} AND dataset_id=${datasetId} ORDER BY ordinal`)
    ).rows;
  }
  async columns(actor: Actor, organizationId: string, tableId: string) {
    await this.policy.assert(
      actor,
      organizationId,
      'dataset_table',
      tableId,
      'read',
    );
    const result = await this.database.db.execute(sql`
      SELECT id,name,ordinal,logical_type AS "logicalType",nullable,security_classification AS "securityClassification",visibility
      FROM data_analytics.dataset_columns WHERE organization_id=${organizationId} AND table_id=${tableId} ORDER BY ordinal`);
    if (!result.rows.length) {
      const table = await this.database.db.execute(
        sql`SELECT id FROM data_analytics.dataset_tables WHERE organization_id=${organizationId} AND id=${tableId}`,
      );
      if (!table.rows[0]) throw new NotFoundException();
    }
    return result.rows;
  }
}
