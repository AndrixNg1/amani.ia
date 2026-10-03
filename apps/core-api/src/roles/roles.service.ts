import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Module,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DatabaseModule, DatabaseService } from '../database/database';
import {
  roles,
  permissions,
  rolePermissions,
  memberships,
  membershipRoles,
} from '../database/schema';
import {
  AuthorizationModule,
  AuthorizationService,
} from '../authorization/authorization.service';
import { AuditModule, AuditService } from '../audit/audit.service';
import type { Actor } from '../common/context';

@Injectable()
export class RolesService {
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
    if (['owner', 'admin', 'member'].includes(input.name))
      throw new BadRequestException();
    return this.database.transaction(async (tx) => {
      await this.policy.lockOrganization(tx, organizationId);
      await this.policy.require(tx, actor, organizationId, 'roles.manage');
      const [role] = await tx
        .insert(roles)
        .values({
          organizationId,
          name: input.name,
          description: input.description ?? '',
        })
        .returning();
      await this.audit.record(
        tx,
        actor,
        organizationId,
        'role.created',
        'role',
        role.id,
      );
      return role;
    });
  }
  async list(actor: Actor, organizationId: string) {
    await this.policy.require(
      this.database.db,
      actor,
      organizationId,
      'roles.read',
    );
    return this.database.db
      .select()
      .from(roles)
      .where(eq(roles.organizationId, organizationId))
      .orderBy(roles.id)
      .limit(100);
  }
  async grant(
    actor: Actor,
    organizationId: string,
    roleId: string,
    permissionKey: string,
    remove = false,
  ) {
    return this.database.transaction(async (tx) => {
      await this.policy.lockOrganization(tx, organizationId);
      await this.policy.require(tx, actor, organizationId, 'roles.manage');
      const [role] = await tx
        .select()
        .from(roles)
        .where(
          and(eq(roles.organizationId, organizationId), eq(roles.id, roleId)),
        );
      if (!role) throw new NotFoundException();
      if (role.isSystem) throw new ForbiddenException();
      const [permission] = await tx
        .select()
        .from(permissions)
        .where(eq(permissions.key, permissionKey));
      if (!permission) throw new BadRequestException();
      if (
        !(await this.policy.isOwner(tx, actor, organizationId)) &&
        !(await this.policy.effective(actor, organizationId, tx)).includes(
          permissionKey,
        )
      )
        throw new ForbiddenException();
      if (remove) {
        await tx
          .delete(rolePermissions)
          .where(
            and(
              eq(rolePermissions.organizationId, organizationId),
              eq(rolePermissions.roleId, roleId),
              eq(rolePermissions.permissionId, permission.id),
            ),
          );
      } else {
        await tx
          .insert(rolePermissions)
          .values({ organizationId, roleId, permissionId: permission.id })
          .onConflictDoNothing();
      }
      await this.audit.record(
        tx,
        actor,
        organizationId,
        remove ? 'permission.revoked' : 'permission.assigned',
        'role',
        roleId,
        { permissionKey },
      );
      return { roleId, permissionKey, assigned: !remove };
    });
  }
  async assign(
    actor: Actor,
    organizationId: string,
    membershipId: string,
    roleId: string,
    remove = false,
  ) {
    return this.database.transaction(async (tx) => {
      await this.policy.lockOrganization(tx, organizationId);
      await this.policy.require(tx, actor, organizationId, 'roles.manage');
      const [role] = await tx
        .select()
        .from(roles)
        .where(
          and(eq(roles.organizationId, organizationId), eq(roles.id, roleId)),
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
      if (!role || !member) throw new NotFoundException();
      if (role.name === 'owner' && role.isSystem)
        throw new ForbiddenException();
      const owner = await this.policy.isOwner(tx, actor, organizationId);
      if (!owner) {
        if (role.isSystem && role.name === 'admin')
          throw new ForbiddenException();
        const grants = await tx.execute<{
          key: string;
        }>(sql`SELECT p.key FROM core_platform.role_permissions rp
          JOIN core_platform.permissions p ON p.id = rp.permission_id
          WHERE rp.organization_id = ${organizationId} AND rp.role_id = ${roleId}`);
        const effective = await this.policy.effective(
          actor,
          organizationId,
          tx,
        );
        if (grants.rows.some((p) => !effective.includes(p.key)))
          throw new ForbiddenException();
      }
      if (member.status !== 'active' && !remove)
        throw new BadRequestException();
      if (remove)
        await tx
          .delete(membershipRoles)
          .where(
            and(
              eq(membershipRoles.organizationId, organizationId),
              eq(membershipRoles.membershipId, membershipId),
              eq(membershipRoles.roleId, roleId),
            ),
          );
      else
        await tx
          .insert(membershipRoles)
          .values({ organizationId, membershipId, roleId })
          .onConflictDoNothing();
      await this.audit.record(
        tx,
        actor,
        organizationId,
        remove ? 'membership.role_revoked' : 'membership.role_assigned',
        'membership',
        membershipId,
        { roleId },
      );
      return { membershipId, roleId, assigned: !remove };
    });
  }
}
@Module({
  imports: [DatabaseModule, AuthorizationModule, AuditModule],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
