import { Injectable, Module, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DatabaseModule, DatabaseService } from '../database/database';
import { teams, memberships, teamMemberships } from '../database/schema';
import {
  AuthorizationModule,
  AuthorizationService,
} from '../authorization/authorization.service';
import { AuditModule, AuditService } from '../audit/audit.service';
import type { Actor } from '../common/context';

@Injectable()
export class TeamsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: AuthorizationService,
    private readonly audit: AuditService,
  ) {}
  async create(
    actor: Actor,
    organizationId: string,
    input: { name: string; description?: string },
  ) {
    return this.database.transaction(async (tx) => {
      await this.policy.lockOrganization(tx, organizationId);
      await this.policy.require(tx, actor, organizationId, 'teams.manage');
      const [team] = await tx
        .insert(teams)
        .values({
          organizationId,
          name: input.name.trim(),
          description: input.description ?? '',
        })
        .returning();
      await this.audit.record(
        tx,
        actor,
        organizationId,
        'team.created',
        'team',
        team.id,
      );
      return team;
    });
  }
  async list(actor: Actor, organizationId: string) {
    await this.policy.require(
      this.database.db,
      actor,
      organizationId,
      'teams.read',
    );
    return this.database.db
      .select()
      .from(teams)
      .where(eq(teams.organizationId, organizationId))
      .orderBy(teams.id)
      .limit(100);
  }
  async setMember(
    actor: Actor,
    organizationId: string,
    teamId: string,
    membershipId: string,
    remove = false,
  ) {
    return this.database.transaction(async (tx) => {
      await this.policy.lockOrganization(tx, organizationId);
      await this.policy.require(tx, actor, organizationId, 'teams.manage');
      const [team] = await tx
        .select()
        .from(teams)
        .where(
          and(eq(teams.organizationId, organizationId), eq(teams.id, teamId)),
        );
      const [member] = await tx
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.organizationId, organizationId),
            eq(memberships.id, membershipId),
          ),
        );
      if (!team || !member || (!remove && member.status !== 'active'))
        throw new NotFoundException();
      if (remove)
        await tx
          .delete(teamMemberships)
          .where(
            and(
              eq(teamMemberships.organizationId, organizationId),
              eq(teamMemberships.teamId, teamId),
              eq(teamMemberships.membershipId, membershipId),
            ),
          );
      else
        await tx
          .insert(teamMemberships)
          .values({ organizationId, teamId, membershipId })
          .onConflictDoNothing();
      await this.audit.record(
        tx,
        actor,
        organizationId,
        remove ? 'team.member_removed' : 'team.member_added',
        'team',
        teamId,
      );
      return { teamId, membershipId, assigned: !remove };
    });
  }
}
@Module({
  imports: [DatabaseModule, AuthorizationModule, AuditModule],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
