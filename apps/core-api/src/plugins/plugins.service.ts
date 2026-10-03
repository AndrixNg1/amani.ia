import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Module,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, desc } from 'drizzle-orm';
import { DatabaseModule, DatabaseService } from '../database/database';
import { plugins, pluginVersions, installations } from '../database/schema';
import {
  AuthorizationModule,
  AuthorizationService,
} from '../authorization/authorization.service';
import {
  EntitlementsModule,
  EntitlementsService,
} from '../entitlements/entitlements.service';
import { AuditModule, AuditService } from '../audit/audit.service';
import { assertScope } from '../common/context';
import type { Actor } from '../common/context';
import { canTransition, installationStates } from './lifecycle';
import type { InstallationState } from './lifecycle';

@Injectable()
export class PluginsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: AuthorizationService,
    private readonly entitlements: EntitlementsService,
    private readonly audit: AuditService,
  ) {}
  async catalog(actor: Actor, pluginKey: string) {
    await this.policy.activeUser(this.database.db, actor.userId);
    const [plugin] = await this.database.db
      .select()
      .from(plugins)
      .where(eq(plugins.key, pluginKey));
    if (!plugin) throw new NotFoundException();
    const versions = await this.database.db
      .select({
        id: pluginVersions.id,
        version: pluginVersions.version,
        apiVersion: pluginVersions.apiVersion,
      })
      .from(pluginVersions)
      .where(eq(pluginVersions.pluginId, plugin.id))
      .orderBy(desc(pluginVersions.createdAt), desc(pluginVersions.id))
      .limit(100);
    return { ...plugin, versions };
  }
  async request(
    actor: Actor,
    organizationId: string,
    pluginKey: string,
    versionId: string,
  ) {
    return this.database.transaction(async (tx) => {
      await this.policy.lockOrganization(tx, organizationId);
      await this.policy.require(tx, actor, organizationId, 'plugins.manage');
      const [plugin] = await tx
        .select()
        .from(plugins)
        .where(
          and(eq(plugins.key, pluginKey), eq(plugins.status, 'available')),
        );
      if (!plugin) throw new NotFoundException();
      if (
        !(await this.entitlements.allows(
          tx,
          organizationId,
          `plugin:${pluginKey}`,
        ))
      )
        throw new ForbiddenException();
      const [version] = await tx
        .select()
        .from(pluginVersions)
        .where(
          and(
            eq(pluginVersions.pluginId, plugin.id),
            eq(pluginVersions.id, versionId),
          ),
        );
      if (!version || version.apiVersion !== '1')
        throw new BadRequestException();
      const [existing] = await tx
        .select()
        .from(installations)
        .where(
          and(
            eq(installations.organizationId, organizationId),
            eq(installations.pluginId, plugin.id),
          ),
        );
      if (existing) {
        if (existing.versionId !== versionId) throw new ConflictException();
        return existing; // Retrying a request does not reactivate a disabled installation.
      }
      const [installation] = await tx
        .insert(installations)
        .values({ organizationId, pluginId: plugin.id, versionId })
        .returning();
      await this.audit.record(
        tx,
        actor,
        organizationId,
        'plugin.requested',
        'plugin_installation',
        installation.id,
        { pluginKey },
      );
      return installation;
    });
  }
  async get(actor: Actor, organizationId: string, installationId: string) {
    await this.policy.require(
      this.database.db,
      actor,
      organizationId,
      'organization.read',
    );
    const [installation] = await this.database.db
      .select()
      .from(installations)
      .where(
        and(
          eq(installations.organizationId, organizationId),
          eq(installations.id, installationId),
        ),
      );
    if (!installation) throw new NotFoundException();
    return installation;
  }
  /** Control-plane metadata only; callers must establish actual provisioning completion separately. */
  async transition(
    actor: Actor,
    organizationId: string,
    installationId: string,
    status: InstallationState,
  ) {
    assertScope(actor, organizationId);
    if (!installationStates.includes(status)) throw new BadRequestException();
    return this.database.transaction(async (tx) => {
      await this.policy.lockOrganization(tx, organizationId);
      if (status === 'disabled' || status === 'suspended')
        await this.policy.require(tx, actor, organizationId, 'plugins.manage');
      else await this.policy.platformAdmin(tx, actor);
      const [current] = await tx
        .select()
        .from(installations)
        .where(
          and(
            eq(installations.organizationId, organizationId),
            eq(installations.id, installationId),
          ),
        );
      if (!current) throw new NotFoundException();
      if (!canTransition(current.status as InstallationState, status))
        throw new ConflictException();
      if (current.status === status) return current;
      const [plugin] = await tx
        .select()
        .from(plugins)
        .where(eq(plugins.id, current.pluginId));
      if (
        ['requested', 'provisioning', 'active'].includes(status) &&
        (plugin.status !== 'available' ||
          !(await this.entitlements.allows(
            tx,
            organizationId,
            `plugin:${plugin.key}`,
          )))
      )
        throw new ForbiddenException();
      const [updated] = await tx
        .update(installations)
        .set({
          status,
          updatedAt: new Date(),
          ...(status === 'active'
            ? { activatedAt: new Date(), disabledAt: null }
            : {}),
          ...(status === 'disabled' ? { disabledAt: new Date() } : {}),
        })
        .where(
          and(
            eq(installations.organizationId, organizationId),
            eq(installations.id, installationId),
          ),
        )
        .returning();
      await this.audit.record(
        tx,
        actor,
        organizationId,
        `plugin.${status === 'active' ? 'activated' : status}`,
        'plugin_installation',
        installationId,
        { status, pluginKey: plugin.key },
      );
      return updated;
    });
  }
}
@Module({
  imports: [
    DatabaseModule,
    AuthorizationModule,
    EntitlementsModule,
    AuditModule,
  ],
  providers: [PluginsService],
  exports: [PluginsService],
})
export class PluginsModule {}
