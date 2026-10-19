import { Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Actor } from '../common/context';
import type { CreateConnectorSourceDto } from '../common/dto';
import { DatabaseService } from '../database/database';
import { ResourcePolicy } from '../authorization/resource-policy';

@Injectable()
export class SourcesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: ResourcePolicy,
  ) {}
  async createConnector(
    actor: Actor,
    organizationId: string,
    dto: CreateConnectorSourceDto,
  ) {
    const authorization = await this.policy.coreAuthorize(
      actor,
      organizationId,
      'manage',
    );
    const result = await this.database.db.execute(sql`
      INSERT INTO data_analytics.data_sources(organization_id,source_kind,provider,display_name,connector_reference,created_by_membership_id)
      VALUES(${organizationId},'connector',${dto.provider},${dto.displayName.trim()},${dto.connectorReference},${authorization.membershipId})
      RETURNING id,source_kind AS "sourceKind",provider,display_name AS "displayName",connector_reference AS "connectorReference",status`);
    return result.rows[0];
  }
  async list(actor: Actor, organizationId: string) {
    await this.policy.coreAuthorize(actor, organizationId, 'manage');
    return (
      await this.database.db.execute(sql`
      SELECT id,source_kind AS "sourceKind",provider,display_name AS "displayName",connector_reference AS "connectorReference",status,created_at AS "createdAt"
      FROM data_analytics.data_sources WHERE organization_id=${organizationId} AND status <> 'archived' ORDER BY created_at DESC`)
    ).rows;
  }
  async get(actor: Actor, organizationId: string, id: string) {
    await this.policy.coreAuthorize(actor, organizationId, 'manage');
    const result = await this.database.db.execute(sql`
      SELECT id,source_kind AS "sourceKind",provider,display_name AS "displayName",connector_reference AS "connectorReference",status,created_at AS "createdAt",updated_at AS "updatedAt"
      FROM data_analytics.data_sources WHERE organization_id=${organizationId} AND id=${id} AND status <> 'archived'`);
    if (!result.rows[0]) throw new NotFoundException();
    return result.rows[0];
  }
  async archive(actor: Actor, organizationId: string, id: string) {
    await this.policy.coreAuthorize(actor, organizationId, 'manage');
    const result = await this.database.db.execute(sql`
      UPDATE data_analytics.data_sources SET status='archived',updated_at=now()
      WHERE organization_id=${organizationId} AND id=${id} AND status <> 'archived' RETURNING id,status`);
    if (!result.rows[0]) throw new NotFoundException();
    return result.rows[0];
  }
}
