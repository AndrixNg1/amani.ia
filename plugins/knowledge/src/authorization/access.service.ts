import { Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Actor } from '../common/context';
import { DatabaseService } from '../database/database';
import { ResourcePolicy } from './resource-policy';
import type { GrantDto } from '../common/dto';
@Injectable()
export class AccessService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: ResourcePolicy,
  ) {}
  async list(
    actor: Actor,
    org: string,
    type: 'knowledge_base' | 'document',
    resourceId: string,
  ) {
    await this.policy.assert(actor, org, type, resourceId, 'manage');
    return (
      await this.database.db.execute(
        sql`SELECT id,membership_id AS "membershipId",action,created_at AS "createdAt" FROM knowledge.resource_grants WHERE organization_id=${org} AND resource_type=${type} AND resource_id=${resourceId} ORDER BY created_at ASC`,
      )
    ).rows;
  }
  async grant(
    actor: Actor,
    org: string,
    type: 'knowledge_base' | 'document',
    resourceId: string,
    dto: GrantDto,
  ) {
    const actorMember = await this.policy.assertManager(
      actor,
      org,
      type,
      resourceId,
      dto.membershipId,
    );
    const result = await this.database.db.execute(
      sql`INSERT INTO knowledge.resource_grants(organization_id,resource_type,resource_id,membership_id,action,created_by_membership_id) VALUES (${org},${type},${resourceId},${dto.membershipId},${dto.action},${actorMember}) ON CONFLICT(organization_id,resource_type,resource_id,membership_id,action) DO NOTHING RETURNING id,membership_id AS "membershipId",action`,
    );
    return (
      result.rows[0] ?? {
        membershipId: dto.membershipId,
        action: dto.action,
        existing: true,
      }
    );
  }
  async revoke(
    actor: Actor,
    org: string,
    type: 'knowledge_base' | 'document',
    resourceId: string,
    grantId: string,
  ) {
    await this.policy.assertManager(actor, org, type, resourceId);
    const result = await this.database.db.execute(
      sql`DELETE FROM knowledge.resource_grants WHERE organization_id=${org} AND resource_type=${type} AND resource_id=${resourceId} AND id=${grantId} RETURNING id`,
    );
    if (!result.rows[0]) throw new NotFoundException();
    return { id: grantId, revoked: true };
  }
}
