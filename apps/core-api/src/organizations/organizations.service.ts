import { Injectable, Module, NotFoundException } from '@nestjs/common';
import { eq, isNull } from 'drizzle-orm';
import { DatabaseModule, DatabaseService } from '../database/database';
import {
  organizations,
  memberships,
  roles,
  permissions,
  rolePermissions,
  membershipRoles,
} from '../database/schema';
import {
  AuthorizationModule,
  AuthorizationService,
} from '../authorization/authorization.service';
import { AuditModule, AuditService } from '../audit/audit.service';
import type { Actor } from '../common/context';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: AuthorizationService,
    private readonly audit: AuditService,
  ) {}
  async create(actor: Actor, input: { name: string; slug: string }) {
    return this.database.transaction(async (tx) => {
      await this.policy.activeUser(tx, actor.userId);
      const [organization] = await tx
        .insert(organizations)
        .values({ name: input.name.trim(), slug: input.slug })
        .returning();
      const organizationId = organization.id;
      const [owner] = await tx
        .insert(memberships)
        .values({ organizationId, userId: actor.userId })
        .returning();
      const defaults = await tx
        .insert(roles)
        .values(
          ['owner', 'admin', 'member'].map((name) => ({
            organizationId,
            name,
            isSystem: true,
          })),
        )
        .returning();
      const catalog = await tx
        .select()
        .from(permissions)
        .where(isNull(permissions.pluginKey));
      // Explicit baseline, never automatically grant future catalog permissions.
      const adminKeys = [
        'organization.read',
        'organization.manage',
        'members.read',
        'members.manage',
        'teams.read',
        'teams.manage',
        'roles.read',
        'roles.manage',
        'plugins.use',
        'plugins.manage',
        'audit.read',
      ];
      if (adminKeys.some((key) => !catalog.some((p) => p.key === key)))
        throw new Error('Core permission catalog is incomplete');
      const grants = defaults.flatMap((role) =>
        catalog
          .filter((p) =>
            (role.name === 'member'
              ? ['organization.read', 'teams.read', 'plugins.use']
              : adminKeys
            ).includes(p.key),
          )
          .map((permission) => ({
            organizationId,
            roleId: role.id,
            permissionId: permission.id,
          })),
      );
      await tx.insert(rolePermissions).values(grants);
      await tx.insert(membershipRoles).values({
        organizationId,
        membershipId: owner.id,
        roleId: defaults.find((r) => r.name === 'owner')!.id,
      });
      await this.audit.record(
        tx,
        actor,
        organizationId,
        'organization.created',
        'organization',
        organizationId,
      );
      return organization;
    });
  }
  async get(actor: Actor, organizationId: string) {
    await this.policy.require(
      this.database.db,
      actor,
      organizationId,
      'organization.read',
    );
    const [organization] = await this.database.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));
    if (!organization) throw new NotFoundException();
    return organization;
  }
  async update(actor: Actor, organizationId: string, name: string) {
    return this.database.transaction(async (tx) => {
      await this.policy.lockOrganization(tx, organizationId);
      await this.policy.require(
        tx,
        actor,
        organizationId,
        'organization.manage',
      );
      const [organization] = await tx
        .update(organizations)
        .set({ name: name.trim(), updatedAt: new Date() })
        .where(eq(organizations.id, organizationId))
        .returning();
      await this.audit.record(
        tx,
        actor,
        organizationId,
        'organization.updated',
        'organization',
        organizationId,
      );
      return organization;
    });
  }
}
@Module({
  imports: [DatabaseModule, AuthorizationModule, AuditModule],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
