import { Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Actor } from '../common/context';
import { DatabaseService } from '../database/database';
import { ResourcePolicy } from '../authorization/resource-policy';
import type { ManualSourceDto } from '../common/dto';
@Injectable()
export class SourcesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: ResourcePolicy,
  ) {}
  async createManual(
    actor: Actor,
    org: string,
    baseId: string,
    dto: ManualSourceDto,
  ) {
    const member = await this.policy.assert(
      actor,
      org,
      'knowledge_base',
      baseId,
      'ingest',
    );
    const result = await this.database.transaction(async (tx) => {
      const source = await tx.execute<{
        id: string;
        knowledgeBaseId: string;
        sourceKind: string;
        displayName: string;
        status: string;
      }>(
        sql`INSERT INTO knowledge.knowledge_sources(organization_id,knowledge_base_id,source_kind,display_name,created_by_membership_id) VALUES (${org},${baseId},'manual_upload',${dto.displayName.trim()},${member}) RETURNING id,knowledge_base_id AS "knowledgeBaseId",source_kind AS "sourceKind",display_name AS "displayName",status`,
      );
      const value = source.rows[0]!;
      await tx.execute(
        sql`INSERT INTO knowledge.audit_events(organization_id,actor_membership_id,action,resource_type,resource_id,request_id,correlation_id) VALUES(${org},${member},'knowledge_source.created','knowledge_source',${value.id},${actor.requestId},${actor.correlationId})`,
      );
      return value;
    });
    return result;
  }
  async list(actor: Actor, org: string, baseId: string) {
    await this.policy.assert(actor, org, 'knowledge_base', baseId, 'read');
    const result = await this.database.db.execute(
      sql`SELECT id,knowledge_base_id AS "knowledgeBaseId",source_kind AS "sourceKind",provider,display_name AS "displayName",external_reference AS "externalReference",status,created_at AS "createdAt" FROM knowledge.knowledge_sources WHERE organization_id=${org} AND knowledge_base_id=${baseId} AND status='active' ORDER BY created_at DESC`,
    );
    return result.rows;
  }
  async get(actor: Actor, org: string, baseId: string, id: string) {
    await this.policy.assert(actor, org, 'knowledge_base', baseId, 'read');
    const result = await this.database.db.execute(
      sql`SELECT id,knowledge_base_id AS "knowledgeBaseId",source_kind AS "sourceKind",provider,display_name AS "displayName",external_reference AS "externalReference",status FROM knowledge.knowledge_sources WHERE organization_id=${org} AND knowledge_base_id=${baseId} AND id=${id} AND status='active'`,
    );
    if (!result.rows[0]) throw new NotFoundException();
    return result.rows[0];
  }
}
