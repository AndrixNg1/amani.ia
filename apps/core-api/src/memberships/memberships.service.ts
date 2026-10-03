import {
  ForbiddenException,
  Injectable,
  Module,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DatabaseModule, DatabaseService } from '../database/database';
import { memberships } from '../database/schema';
import {
  AuthorizationModule,
  AuthorizationService,
} from '../authorization/authorization.service';
import { AuditModule, AuditService } from '../audit/audit.service';
import type { Actor } from '../common/context';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: AuthorizationService,
    private readonly audit: AuditService,
  ) {}
  async create(actor: Actor, organizationId: string, userId: string) {
    return this.database.transaction(async (tx) => {
      await this.policy.lockOrganization(tx, organizationId);
      await this.policy.require(tx, actor, organizationId, 'members.manage');
      await this.policy.activeUser(tx, userId);
      const [member] = await tx
        .insert(memberships)
        .values({ organizationId, userId })
        .returning();
      // No invitation or implicit role grant: explicit role assignment is required.
      await this.audit.record(
        tx,
        actor,
        organizationId,
        'membership.created',
        'membership',
        member.id,
      );
      return member;
    });
  }
  async get(actor: Actor, organizationId: string, userId: string) {
    await this.policy.require(
      this.database.db,
      actor,
      organizationId,
      'members.read',
    );
    const [member] = await this.database.db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.organizationId, organizationId),
          eq(memberships.userId, userId),
        ),
      );
    if (!member) throw new NotFoundException();
    return member;
  }
  async setStatus(
    actor: Actor,
    organizationId: string,
    membershipId: string,
    status: 'active' | 'inactive',
  ) {
    return this.database.transaction(async (tx) => {
      await this.policy.lockOrganization(tx, organizationId);
      await this.policy.require(tx, actor, organizationId, 'members.manage');
      const [member] = await tx
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.organizationId, organizationId),
            eq(memberships.id, membershipId),
          ),
        );
      if (!member) throw new NotFoundException();
      const owner =
        await tx.execute(sql`SELECT r.id FROM core_platform.membership_roles a
        JOIN core_platform.roles r ON r.organization_id = a.organization_id AND r.id = a.role_id
        WHERE a.organization_id = ${organizationId} AND a.membership_id = ${membershipId} AND r.name = 'owner' AND r.is_system`);
      if (owner.rows.length) throw new ForbiddenException();
      const [updated] = await tx
        .update(memberships)
        .set({ status, updatedAt: new Date() })
        .where(
          and(
            eq(memberships.organizationId, organizationId),
            eq(memberships.id, membershipId),
          ),
        )
        .returning();
      await this.audit.record(
        tx,
        actor,
        organizationId,
        'membership.status_changed',
        'membership',
        membershipId,
        { status },
      );
      return updated;
    });
  }
}
@Module({
  imports: [DatabaseModule, AuthorizationModule, AuditModule],
  providers: [MembershipsService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
