import { Injectable, Module } from '@nestjs/common';
import type { Actor } from '../common/context';
import { DatabaseModule, DatabaseService } from '../database/database';
import type { Session } from '../database/database';
import { auditEvents } from '../database/schema';
import {
  AuthorizationModule,
  AuthorizationService,
} from '../authorization/authorization.service';
import { desc, eq } from 'drizzle-orm';

@Injectable()
export class AuditService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: AuthorizationService,
  ) {}
  async record(
    db: Session,
    actor: Actor,
    organizationId: string | null,
    action: string,
    targetType: string,
    targetId: string,
    metadata: {
      roleId?: string;
      permissionKey?: string;
      status?: string;
      pluginKey?: string;
    } = {},
  ) {
    // Only allowlisted metadata from service code. Never accept request bodies here.
    const safe = Object.fromEntries(
      Object.entries(metadata).filter(([key]) =>
        ['roleId', 'permissionKey', 'status', 'pluginKey'].includes(key),
      ),
    );
    await db.insert(auditEvents).values({
      organizationId,
      actorUserId: actor.userId,
      action,
      targetType,
      targetId,
      correlationId: actor.correlationId,
      metadata: safe,
    });
  }
  async list(actor: Actor, organizationId: string) {
    await this.policy.require(
      this.database.db,
      actor,
      organizationId,
      'audit.read',
    );
    return this.database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, organizationId))
      .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
      .limit(100);
  }
}
@Module({
  imports: [DatabaseModule, AuthorizationModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
