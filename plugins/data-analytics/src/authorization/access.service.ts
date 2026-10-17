import { Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Actor } from '../common/context';
import type { GrantDto } from '../common/dto';
import { DatabaseService } from '../database/database';
import { ResourcePolicy } from './resource-policy';
import type { ResourceType } from './resource-policy';
@Injectable()
export class AccessService {
  constructor(private readonly database: DatabaseService, private readonly policy: ResourcePolicy) {}
  async list(actor: Actor, organizationId: string, type: ResourceType, resourceId: string) {
    await this.policy.assert(actor, organizationId, type, resourceId, 'manage');
    return (await this.database.db.execute(sql`
      SELECT id,subject_type AS "subjectType",subject_id AS "subjectId",action,created_at AS "createdAt"
      FROM data_analytics.resource_grants WHERE organization_id=${organizationId} AND resource_type=${type} AND resource_id=${resourceId}
      ORDER BY created_at ASC`)).rows;
  }
  async grant(actor: Actor, organizationId: string, type: ResourceType, resourceId: string, dto: GrantDto) {
    const member = await this.policy.assertManager(actor, organizationId, type, resourceId, dto.membershipId);
    const result = await this.database.db.execute(sql`
      INSERT INTO data_analytics.resource_grants(organization_id,resource_type,resource_id,subject_type,subject_id,action,created_by_membership_id)
      VALUES(${organizationId},${type},${resourceId},'membership',${dto.membershipId},${dto.action},${member})
      ON CONFLICT(organization_id,resource_type,resource_id,subject_type,subject_id,action) DO NOTHING
      RETURNING id,subject_id AS "subjectId",action`);
    return result.rows[0] ?? { membershipId: dto.membershipId, action: dto.action, existing: true };
  }
  async revoke(actor: Actor, organizationId: string, type: ResourceType, resourceId: string, grantId: string) {
    await this.policy.assertManager(actor, organizationId, type, resourceId);
    const result = await this.database.db.execute(sql`
      DELETE FROM data_analytics.resource_grants WHERE organization_id=${organizationId} AND resource_type=${type} AND resource_id=${resourceId} AND id=${grantId}
      RETURNING id`);
    if (!result.rows[0]) throw new NotFoundException();
    return { id: grantId, revoked: true };
  }
}
