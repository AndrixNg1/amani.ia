import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Actor } from '../common/context';
import type { CreateDatasetDto, UpdateDatasetDto } from '../common/dto';
import { DatabaseService } from '../database/database';
import { ResourcePolicy } from '../authorization/resource-policy';

@Injectable()
export class DatasetsService {
  constructor(private readonly database: DatabaseService, private readonly policy: ResourcePolicy) {}
  async create(actor: Actor, organizationId: string, dto: CreateDatasetDto) {
    const authorization = await this.policy.coreAuthorize(actor, organizationId, 'manage');
    return this.database.transaction(async (tx) => {
      const source = await tx.execute<{ id: string }>(sql`
        SELECT id FROM data_analytics.data_sources WHERE organization_id=${organizationId} AND id=${dto.sourceId} AND status='active'`);
      if (!source.rows[0]) throw new NotFoundException();
      const result = await tx.execute<{ id: string; name: string; description: string; status: string }>(sql`
        INSERT INTO data_analytics.datasets(organization_id,source_id,name,description,created_by_membership_id)
        VALUES(${organizationId},${dto.sourceId},${dto.name.trim()},${dto.description?.trim() ?? ''},${authorization.membershipId})
        RETURNING id,name,description,status`);
      const dataset = result.rows[0];
      for (const action of ['read', 'analyze', 'manage'] as const)
        await tx.execute(sql`
          INSERT INTO data_analytics.resource_grants(organization_id,resource_type,resource_id,subject_type,subject_id,action,created_by_membership_id)
          VALUES(${organizationId},'dataset',${dataset.id},'membership',${authorization.membershipId},${action},${authorization.membershipId})`);
      return dataset;
    }).catch((error: unknown) => {
      if ((error as { code?: string }).code === '23505') throw new ConflictException();
      throw error;
    });
  }
  async list(actor: Actor, organizationId: string) {
    const authorization = await this.policy.coreAuthorize(actor, organizationId, 'read');
    return (await this.database.db.execute(sql`
      SELECT d.id,d.source_id AS "sourceId",d.name,d.description,d.status,d.created_at AS "createdAt",d.updated_at AS "updatedAt"
      FROM data_analytics.datasets d WHERE d.organization_id=${organizationId} AND d.status <> 'archived'
        AND EXISTS(SELECT 1 FROM data_analytics.resource_grants g WHERE g.organization_id=d.organization_id
          AND g.resource_type='dataset' AND g.resource_id=d.id AND g.subject_type='membership'
          AND g.subject_id=${authorization.membershipId} AND g.action='read') ORDER BY d.created_at DESC`)).rows;
  }
  async get(actor: Actor, organizationId: string, id: string) {
    await this.policy.assert(actor, organizationId, 'dataset', id, 'read');
    const result = await this.database.db.execute(sql`
      SELECT id,source_id AS "sourceId",name,description,status,created_at AS "createdAt",updated_at AS "updatedAt"
      FROM data_analytics.datasets WHERE organization_id=${organizationId} AND id=${id} AND status <> 'archived'`);
    if (!result.rows[0]) throw new NotFoundException();
    return result.rows[0];
  }
  async update(actor: Actor, organizationId: string, id: string, dto: UpdateDatasetDto) {
    await this.policy.assertManager(actor, organizationId, 'dataset', id);
    const result = await this.database.db.execute(sql`
      UPDATE data_analytics.datasets SET name=COALESCE(${dto.name?.trim() ?? null},name),description=COALESCE(${dto.description?.trim() ?? null},description),updated_at=now()
      WHERE organization_id=${organizationId} AND id=${id} AND status <> 'archived'
      RETURNING id,name,description,status,updated_at AS "updatedAt"`);
    if (!result.rows[0]) throw new NotFoundException();
    return result.rows[0];
  }
  async archive(actor: Actor, organizationId: string, id: string) {
    await this.policy.assertManager(actor, organizationId, 'dataset', id);
    const result = await this.database.db.execute(sql`
      UPDATE data_analytics.datasets SET status='archived',updated_at=now()
      WHERE organization_id=${organizationId} AND id=${id} AND status <> 'archived' RETURNING id,status`);
    if (!result.rows[0]) throw new NotFoundException();
    return result.rows[0];
  }
}
