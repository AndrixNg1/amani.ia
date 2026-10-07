import { ForbiddenException, Injectable, Module } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DatabaseModule, DatabaseService } from '../database/database';
import type { Session } from '../database/database';
import type { Actor } from '../common/context';
import type { CoreAuthorizationDecision } from '@amani/contracts';

type Grant = {
  key: string | null;
  plugin_key: string | null;
  plugin_allowed: boolean;
};
export type DecisionReason = CoreAuthorizationDecision['reason'];
export type Decision = CoreAuthorizationDecision;

@Injectable()
export class AuthorizationService {
  constructor(private readonly database: DatabaseService) {}
  async activeUser(db: Session, userId: string) {
    const result = await db.execute(
      sql`SELECT id FROM core_platform.users WHERE id = ${userId} AND status = 'active'`,
    );
    if (!result.rows.length) throw new ForbiddenException();
  }
  async platformAdmin(db: Session, actor: Actor) {
    const result = await db.execute(sql`
      SELECT u.id FROM core_platform.users u
      JOIN core_platform.user_platform_roles a ON a.user_id = u.id
      JOIN core_platform.platform_roles r ON r.id = a.role_id
      WHERE u.id = ${actor.userId} AND u.status = 'active' AND r.key = 'platform_admin'`);
    if (!result.rows.length) throw new ForbiddenException();
  }
  async isOwner(
    db: Session,
    actor: Actor,
    organizationId: string,
  ): Promise<boolean> {
    if (actor.organizationId !== organizationId) return false;
    const result = await db.execute(sql`
      SELECT m.id FROM core_platform.memberships m
      JOIN core_platform.users u ON u.id = m.user_id AND u.status = 'active'
      JOIN core_platform.organizations o ON o.id = m.organization_id AND o.status = 'active'
      JOIN core_platform.membership_roles a ON a.organization_id = m.organization_id AND a.membership_id = m.id
      JOIN core_platform.roles r ON r.organization_id = a.organization_id AND r.id = a.role_id
      WHERE m.organization_id = ${organizationId} AND m.user_id = ${actor.userId}
        AND m.status = 'active' AND r.is_system AND r.name = 'owner'`);
    return result.rows.length > 0;
  }
  private async grants(
    db: Session,
    actor: Actor,
    organizationId: string,
  ): Promise<Grant[]> {
    if (actor.organizationId !== organizationId) return [];
    const result = await db.execute<Grant>(sql`
      SELECT DISTINCT p.key, p.plugin_key,
        (p.plugin_key IS NULL OR EXISTS (
          SELECT 1 FROM core_platform.plugins plugin
          JOIN core_platform.organization_plugin_installations i ON i.plugin_id = plugin.id
          JOIN core_platform.organization_subscriptions s ON s.organization_id = i.organization_id
          JOIN core_platform.plans plan ON plan.id = s.plan_id AND plan.status = 'active'
          JOIN core_platform.plan_entitlements e ON e.plan_id = plan.id
          WHERE i.organization_id = m.organization_id AND plugin.key = p.plugin_key
            AND plugin.status = 'available' AND i.status = 'active'
            AND s.status IN ('active','trial') AND s.starts_at <= now()
            AND (s.ends_at IS NULL OR s.ends_at > now()) AND e.enabled
            AND e.capability = 'plugin:' || plugin.key
        )) AS plugin_allowed
      FROM core_platform.memberships m
      JOIN core_platform.users u ON u.id = m.user_id AND u.status = 'active'
      JOIN core_platform.organizations o ON o.id = m.organization_id AND o.status = 'active'
      LEFT JOIN core_platform.membership_roles mr ON mr.organization_id = m.organization_id AND mr.membership_id = m.id
      LEFT JOIN core_platform.roles r ON r.organization_id = mr.organization_id AND r.id = mr.role_id
      LEFT JOIN core_platform.role_permissions rp ON rp.organization_id = r.organization_id AND rp.role_id = r.id
      LEFT JOIN core_platform.permissions p ON p.id = rp.permission_id
      WHERE m.organization_id = ${organizationId} AND m.user_id = ${actor.userId} AND m.status = 'active'`);
    return result.rows;
  }
  async effective(
    actor: Actor,
    organizationId: string,
    db: Session = this.database.db,
  ): Promise<string[]> {
    const grants = await this.grants(db, actor, organizationId);
    const canUse = grants.some((g) => g.key === 'plugins.use');
    return grants
      .filter((g) => g.key && (!g.plugin_key || (canUse && g.plugin_allowed)))
      .map((g) => g.key!)
      .sort();
  }
  async check(
    actor: Actor,
    organizationId: string,
    permission: string,
    pluginKey?: string,
    db: Session = this.database.db,
  ): Promise<Decision> {
    const result = (reason: DecisionReason): Decision => ({
      allowed: reason === 'ROLE_PERMISSION',
      organizationId,
      userId: actor.userId,
      permission,
      reason,
    });
    if (actor.organizationId !== organizationId)
      return result('WRONG_ORGANIZATION');
    const grants = await this.grants(db, actor, organizationId);
    if (!grants.length) return result('INACTIVE_CONTEXT');
    const grant = grants.find((g) => g.key === permission);
    if (!grant) return result('MISSING_PERMISSION');
    if (permission === 'plugins.use' && !pluginKey)
      return result('PLUGIN_UNAVAILABLE');
    if (grant.plugin_key && pluginKey && grant.plugin_key !== pluginKey)
      return result('PLUGIN_UNAVAILABLE');
    if (grant.plugin_key || pluginKey) {
      if (!grants.some((g) => g.key === 'plugins.use'))
        return result('MISSING_PERMISSION');
      if (
        !grant.plugin_allowed ||
        !(await this.pluginEnabled(
          db,
          organizationId,
          grant.plugin_key ?? pluginKey!,
        ))
      )
        return result('PLUGIN_UNAVAILABLE');
    }
    return result('ROLE_PERMISSION');
  }
  async pluginEnabled(
    db: Session,
    organizationId: string,
    pluginKey: string,
  ): Promise<boolean> {
    const result = await db.execute(sql`
      SELECT i.id FROM core_platform.organization_plugin_installations i
      JOIN core_platform.plugins p ON p.id = i.plugin_id AND p.status = 'available'
      JOIN core_platform.organizations o ON o.id = i.organization_id AND o.status = 'active'
      JOIN core_platform.organization_subscriptions s ON s.organization_id = i.organization_id
      JOIN core_platform.plans plan ON plan.id = s.plan_id AND plan.status = 'active'
      JOIN core_platform.plan_entitlements e ON e.plan_id = plan.id
      WHERE i.organization_id = ${organizationId} AND p.key = ${pluginKey} AND i.status = 'active'
        AND s.status IN ('active','trial') AND s.starts_at <= now() AND (s.ends_at IS NULL OR s.ends_at > now())
        AND e.capability = ${`plugin:${pluginKey}`} AND e.enabled`);
    return result.rows.length > 0;
  }
  async require(
    db: Session,
    actor: Actor,
    organizationId: string,
    permission: string,
  ) {
    if (
      !(await this.check(actor, organizationId, permission, undefined, db))
        .allowed
    )
      throw new ForbiddenException();
  }
  async lockOrganization(db: Session, organizationId: string) {
    // All tenant mutations serialize on this row; authorization is checked AFTER the lock.
    await db.execute(
      sql`SELECT id FROM core_platform.organizations WHERE id = ${organizationId} FOR UPDATE`,
    );
  }
}
@Module({
  imports: [DatabaseModule],
  providers: [AuthorizationService],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
