import { Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Actor } from '../common/context';
import { DatabaseService } from '../database/database';
import { CorePolicyClient } from './core-client';
export type ResourceAction = 'read' | 'ingest' | 'manage';
export type ResourceType = 'knowledge_base' | 'document';
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
        ? 'knowledge.documents.read'
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
    const baseId =
      type === 'knowledge_base'
        ? await this.base(organizationId, resourceId)
        : await this.documentBase(organizationId, resourceId);
    const base = await this.database.db.execute<{ exists: boolean }>(
      sql`SELECT EXISTS(SELECT 1 FROM knowledge.resource_grants WHERE organization_id=${organizationId} AND resource_type='knowledge_base' AND resource_id=${baseId} AND membership_id=${membershipId} AND action=${action}) AS exists`,
    );
    if (!base.rows[0]?.exists) throw new NotFoundException();
    if (type === 'document') {
      const document = await this.database.db.execute<{ access_mode: string }>(
        sql`SELECT access_mode FROM knowledge.documents WHERE organization_id=${organizationId} AND id=${resourceId} AND status='active'`,
      );
      if (!document.rows[0]) throw new NotFoundException();
      if (document.rows[0].access_mode === 'restricted') {
        const allowed = await this.database.db.execute<{ exists: boolean }>(
          sql`SELECT EXISTS(SELECT 1 FROM knowledge.resource_grants WHERE organization_id=${organizationId} AND resource_type='document' AND resource_id=${resourceId} AND membership_id=${membershipId} AND action=${action}) AS exists`,
        );
        if (!allowed.rows[0]?.exists) throw new NotFoundException();
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
  private async base(organizationId: string, baseId: string): Promise<string> {
    const row = await this.database.db.execute<{ id: string }>(
      sql`SELECT id FROM knowledge.knowledge_bases WHERE organization_id=${organizationId} AND id=${baseId} AND status='active'`,
    );
    if (!row.rows[0]) throw new NotFoundException();
    return row.rows[0].id;
  }
  private async documentBase(
    organizationId: string,
    documentId: string,
  ): Promise<string> {
    const row = await this.database.db.execute<{ knowledge_base_id: string }>(
      sql`SELECT d.knowledge_base_id FROM knowledge.documents d JOIN knowledge.knowledge_bases b ON b.organization_id=d.organization_id AND b.id=d.knowledge_base_id AND b.status='active' WHERE d.organization_id=${organizationId} AND d.id=${documentId} AND d.status='active'`,
    );
    if (!row.rows[0]) throw new NotFoundException();
    return row.rows[0].knowledge_base_id;
  }
}
