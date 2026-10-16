import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Actor } from '../common/context';
import type { Session } from '../database/database';
import { DatabaseService } from '../database/database';
import { ResourcePolicy } from '../authorization/resource-policy';
import type {
  CreateKnowledgeBaseDto,
  UpdateKnowledgeBaseDto,
} from '../common/dto';
@Injectable()
export class KnowledgeBasesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: ResourcePolicy,
  ) {}
  async create(actor: Actor, org: string, dto: CreateKnowledgeBaseDto) {
    const membership = await this.policy.coreAuthorize(actor, org, 'manage');
    return this.database
      .transaction(async (tx) => {
        const row = await tx.execute<{
          id: string;
          name: string;
          description: string;
          status: string;
        }>(
          sql`INSERT INTO knowledge.knowledge_bases(organization_id,name,description,created_by_membership_id) VALUES (${org},${dto.name.trim()},${dto.description?.trim() ?? ''},${membership.membershipId}) RETURNING id,name,description,status`,
        );
        const base = row.rows[0];
        for (const action of ['read', 'ingest', 'manage'])
          await tx.execute(
            sql`INSERT INTO knowledge.resource_grants(organization_id,resource_type,resource_id,membership_id,action,created_by_membership_id) VALUES (${org},'knowledge_base',${base.id},${membership.membershipId},${action},${membership.membershipId})`,
          );
        await this.audit(
          tx,
          org,
          membership.membershipId,
          'knowledge_base.created',
          'knowledge_base',
          base.id,
          actor,
        );
        return base;
      })
      .catch((error) => {
        if ((error as { code?: string }).code === '23505')
          throw new ConflictException();
        throw error;
      });
  }
  async list(actor: Actor, org: string) {
    const membership = await this.policy.coreAuthorize(actor, org, 'read');
    const rows = await this.database.db.execute(
      sql`SELECT b.id,b.name,b.description,b.status,b.created_at AS "createdAt",b.updated_at AS "updatedAt" FROM knowledge.knowledge_bases b WHERE b.organization_id=${org} AND b.status='active' AND EXISTS(SELECT 1 FROM knowledge.resource_grants g WHERE g.organization_id=b.organization_id AND g.resource_type='knowledge_base' AND g.resource_id=b.id AND g.membership_id=${membership.membershipId} AND g.action='read') ORDER BY b.created_at DESC`,
    );
    return rows.rows;
  }
  async get(actor: Actor, org: string, id: string) {
    await this.policy.assert(actor, org, 'knowledge_base', id, 'read');
    const row = await this.database.db.execute(
      sql`SELECT id,name,description,status,created_at AS "createdAt",updated_at AS "updatedAt" FROM knowledge.knowledge_bases WHERE organization_id=${org} AND id=${id} AND status='active'`,
    );
    if (!row.rows[0]) throw new NotFoundException();
    return row.rows[0];
  }
  async update(
    actor: Actor,
    org: string,
    id: string,
    dto: UpdateKnowledgeBaseDto,
  ) {
    const membership = await this.policy.assertManager(
      actor,
      org,
      'knowledge_base',
      id,
    );
    const result = await this.database.db.execute(
      sql`UPDATE knowledge.knowledge_bases SET name=COALESCE(${dto.name?.trim() ?? null},name),description=COALESCE(${dto.description?.trim() ?? null},description),updated_at=now() WHERE organization_id=${org} AND id=${id} AND status='active' RETURNING id,name,description,status,updated_at AS "updatedAt"`,
    );
    if (!result.rows[0]) throw new NotFoundException();
    await this.audit(
      this.database.db,
      org,
      membership,
      'knowledge_base.updated',
      'knowledge_base',
      id,
      actor,
    );
    return result.rows[0];
  }
  async archive(actor: Actor, org: string, id: string) {
    const membership = await this.policy.assertManager(
      actor,
      org,
      'knowledge_base',
      id,
    );
    const result = await this.database.db.execute(
      sql`UPDATE knowledge.knowledge_bases SET status='archived',updated_at=now() WHERE organization_id=${org} AND id=${id} AND status='active' RETURNING id,status`,
    );
    if (!result.rows[0]) throw new NotFoundException();
    await this.audit(
      this.database.db,
      org,
      membership,
      'knowledge_base.archived',
      'knowledge_base',
      id,
      actor,
    );
    return result.rows[0];
  }
  private async audit(
    db: Session,
    org: string,
    membership: string,
    action: string,
    type: string,
    id: string,
    actor: Actor,
  ) {
    await db.execute(
      sql`INSERT INTO knowledge.audit_events(organization_id,actor_membership_id,action,resource_type,resource_id,request_id,correlation_id) VALUES (${org},${membership},${action},${type},${id},${actor.requestId},${actor.correlationId})`,
    );
  }
}
