import { Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type {
  AnalysisOperation,
  AnalysisScope,
  DatasetColumnScope,
} from '@amani/contracts';
import type { Actor } from '../common/context';
import { DatabaseService } from '../database/database';
import { CorePolicyClient } from './core-client';

export type ResourceAction = 'read' | 'analyze' | 'manage' | 'ingest';
export type ResourceType = 'dataset' | 'dataset_table' | 'dataset_column';
type ColumnScopeRow = Record<string, unknown> & DatasetColumnScope;
@Injectable()
export class ResourcePolicy {
  constructor(
    private readonly database: DatabaseService,
    private readonly core: CorePolicyClient,
  ) {}
  async coreAuthorize(
    actor: Actor,
    organizationId: string,
    action: ResourceAction,
    subjectMembershipId?: string,
  ) {
    const permission =
      action === 'read'
        ? 'analytics.datasets.read'
        : action === 'analyze'
          ? 'analytics.datasets.analyze'
          : action === 'ingest'
            ? 'plugins.use'
            : 'plugins.manage';
    return this.core.authorize(actor, {
      organizationId,
      permission,
      ...(subjectMembershipId ? { subjectMembershipId } : {}),
    });
  }
  async assert(
    actor: Actor,
    organizationId: string,
    type: ResourceType,
    resourceId: string,
    action: ResourceAction,
  ): Promise<string> {
    const result = await this.coreAuthorize(actor, organizationId, action);
    const membershipId = result.membershipId;
    const datasetId = await this.datasetFor(organizationId, type, resourceId);
    const grant = await this.database.db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS(SELECT 1 FROM data_analytics.resource_grants
        WHERE organization_id=${organizationId} AND resource_type='dataset' AND resource_id=${datasetId}
          AND subject_type='membership' AND subject_id=${membershipId} AND action=${action}) AS exists`);
    if (!grant.rows[0]?.exists) throw new NotFoundException();
    if (type !== 'dataset') {
      const restricted = await this.database.db.execute<{
        visibility: string;
      }>(sql`
        SELECT visibility FROM data_analytics.dataset_columns
        WHERE organization_id=${organizationId} AND id=${resourceId}`);
      if (
        type === 'dataset_column' &&
        restricted.rows[0]?.visibility === 'restricted'
      ) {
        const explicit = await this.database.db.execute<{
          exists: boolean;
        }>(sql`
          SELECT EXISTS(SELECT 1 FROM data_analytics.resource_grants
            WHERE organization_id=${organizationId} AND resource_type='dataset_column' AND resource_id=${resourceId}
              AND subject_type='membership' AND subject_id=${membershipId} AND action=${action}) AS exists`);
        if (!explicit.rows[0]?.exists) throw new NotFoundException();
      }
    }
    return membershipId;
  }
  async assertManager(
    actor: Actor,
    organizationId: string,
    type: ResourceType,
    resourceId: string,
    subjectMembershipId?: string,
  ) {
    await this.coreAuthorize(
      actor,
      organizationId,
      'manage',
      subjectMembershipId,
    );
    return this.assert(actor, organizationId, type, resourceId, 'manage');
  }
  async scope(
    organizationId: string,
    datasetId: string,
    membershipId: string,
    operation: AnalysisOperation,
  ): Promise<AnalysisScope> {
    const tables = await this.database.db.execute<{ id: string }>(sql`
      SELECT id FROM data_analytics.dataset_tables
      WHERE organization_id=${organizationId} AND dataset_id=${datasetId} AND metadata_status='ready'
      ORDER BY ordinal`);
    const columns = await this.database.db.execute<ColumnScopeRow>(sql`
      SELECT c.table_id AS "tableId",c.id AS "columnId",
        CASE WHEN c.visibility='restricted' AND NOT EXISTS(
          SELECT 1 FROM data_analytics.resource_grants g WHERE g.organization_id=c.organization_id
            AND g.resource_type='dataset_column' AND g.resource_id=c.id AND g.subject_type='membership'
            AND g.subject_id=${membershipId} AND g.action='analyze'
        ) THEN 'blocked' ELSE 'allowed' END AS access
      FROM data_analytics.dataset_columns c
      JOIN data_analytics.dataset_tables t ON t.organization_id=c.organization_id AND t.id=c.table_id
      WHERE c.organization_id=${organizationId} AND t.dataset_id=${datasetId} ORDER BY t.ordinal,c.ordinal`);
    return {
      datasetId,
      allowedTableIds: tables.rows.map((table) => table.id),
      columns: columns.rows,
      operation,
    };
  }
  private async datasetFor(
    organizationId: string,
    type: ResourceType,
    resourceId: string,
  ): Promise<string> {
    const query =
      type === 'dataset'
        ? sql`SELECT id AS dataset_id FROM data_analytics.datasets WHERE organization_id=${organizationId} AND id=${resourceId} AND status <> 'archived'`
        : type === 'dataset_table'
          ? sql`SELECT dataset_id FROM data_analytics.dataset_tables t JOIN data_analytics.datasets d ON d.organization_id=t.organization_id AND d.id=t.dataset_id AND d.status <> 'archived' WHERE t.organization_id=${organizationId} AND t.id=${resourceId}`
          : sql`SELECT t.dataset_id FROM data_analytics.dataset_columns c JOIN data_analytics.dataset_tables t ON t.organization_id=c.organization_id AND t.id=c.table_id JOIN data_analytics.datasets d ON d.organization_id=t.organization_id AND d.id=t.dataset_id AND d.status <> 'archived' WHERE c.organization_id=${organizationId} AND c.id=${resourceId}`;
    const result = await this.database.db.execute<{ dataset_id: string }>(
      query,
    );
    if (!result.rows[0]) throw new NotFoundException();
    return result.rows[0].dataset_id;
  }
}
