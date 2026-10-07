/** Core-owned synthetic fixture process. Communicates only URL/IDs via IPC.
 * Every fixture and API mutation is held in one PostgreSQL transaction and rolled back.
 * Never imported by Gateway production code; never replaces identity or policy checks.
 */
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import {
  DatabaseService,
  verifyDatabaseIdentity,
} from '../src/database/database';
import type { Transaction } from '../src/database/database';
import * as schema from '../src/database/schema';
import { migrateInTransaction } from '../src/database/migrate';
import { seedDevelopment } from '../src/database/seed';
import { coreConfig, loadLocalEnvironment } from '../src/common/config';
import { configureHttp } from '../src/common/http';
import type { Actor } from '../src/common/context';
import type { CorrelationId, OrganizationId, UserId } from '@amani/types';
import { OrganizationsService } from '../src/organizations/organizations.service';
import { MembershipsService } from '../src/memberships/memberships.service';
import { RolesService } from '../src/roles/roles.service';
import { PluginsService } from '../src/plugins/plugins.service';
import { PlansService } from '../src/plans/plans.service';

async function main() {
  loadLocalEnvironment();
  if (
    !process.send ||
    process.env.GATEWAY_CORE_TESTS !== 'true' ||
    process.env.NODE_ENV !== 'test' ||
    !['test', 'development'].includes(coreConfig().environment)
  )
    throw new Error('Explicit test configuration required');
  const real = new DatabaseService();
  const rollback = new Error('Rollback synthetic Gateway fixtures');
  const stop = new AbortController();
  process.on('SIGTERM', () => stop.abort());
  process.on('disconnect', () => stop.abort());
  process.on('message', (message: unknown) => {
    if (message === 'stop') stop.abort();
  });
  const timer = setTimeout(() => stop.abort(), 180000);
  timer.unref();
  try {
    await real.db.transaction(async (tx) => {
      await verifyDatabaseIdentity(tx);
      await migrateInTransaction(tx);
      await seedDevelopment(tx);
      const fixture = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(DatabaseService)
        .useValue({
          db: tx,
          transaction: <T>(work: (db: Transaction) => Promise<T>) =>
            tx.transaction(work),
          ready: () => verifyDatabaseIdentity(tx),
        })
        .compile();
      const app = fixture.createNestApplication({
        rawBody: true,
        logger: false,
      });
      configureHttp(app);
      try {
        const names = [
          'owner',
          'reader',
          'noRole',
          'inactive',
          'outsider',
          'otherOwner',
          'platform',
        ] as const;
        const rows = await tx
          .insert(schema.users)
          .values(
            names.map((name) => ({
              email: `gateway-${name.toLowerCase()}-${randomUUID()}@example.invalid`,
              displayName: name,
            })),
          )
          .returning();
        const ids = Object.fromEntries(
          names.map((name, i) => [name, rows[i].id]),
        ) as Record<(typeof names)[number], string>;
        const actor = (id: string, org?: string): Actor => ({
          userId: id as UserId,
          organizationId: org as OrganizationId | undefined,
          correlationId: randomUUID() as CorrelationId,
        });
        const organizations = app.get(OrganizationsService);
        const memberships = app.get(MembershipsService);
        const roles = app.get(RolesService);
        const plugins = app.get(PluginsService);
        const plans = app.get(PlansService);
        const org = await organizations.create(actor(ids.owner), {
          name: 'Synthetic Gateway A',
          slug: `gateway-${randomUUID()}`,
        });
        const other = await organizations.create(actor(ids.otherOwner), {
          name: 'Synthetic Gateway B',
          slug: `gateway-${randomUUID()}`,
        });
        const owner = actor(ids.owner, org.id);
        const platform = actor(ids.platform, org.id);
        const [platformRole] = await tx
          .select()
          .from(schema.platformRoles)
          .where(eq(schema.platformRoles.key, 'platform_admin'));
        await tx
          .insert(schema.userPlatformRoles)
          .values({ userId: ids.platform, roleId: platformRole.id });
        const readerRole = await roles.create(owner, org.id, {
          name: 'gateway-reader',
        });
        for (const permission of [
          'organization.read',
          'members.read',
          'plugins.use',
        ])
          await roles.grant(owner, org.id, readerRole.id, permission);
        for (const name of ['reader', 'noRole', 'inactive'] as const) {
          const member = await memberships.create(owner, org.id, ids[name]);
          if (name !== 'noRole')
            await roles.assign(owner, org.id, member.id, readerRole.id);
          if (name === 'inactive')
            await memberships.setStatus(owner, org.id, member.id, 'inactive');
        }
        const plan = (await plans.list(owner)).find(
          (p) => p.key === 'development-all',
        )!;
        await plans.setSubscription(platform, org.id, plan.id, 'active');
        for (const key of ['knowledge', 'connectors'] as const) {
          const catalog = await plugins.catalog(owner, key);
          const installation = await plugins.request(
            owner,
            org.id,
            key,
            catalog.versions[0].id,
          );
          await plugins.transition(
            platform,
            org.id,
            installation.id,
            'provisioning',
          );
          await plugins.transition(platform, org.id, installation.id, 'active');
          if (key === 'connectors')
            await plugins.transition(
              owner,
              org.id,
              installation.id,
              'disabled',
            );
        }
        await app.listen(0, '127.0.0.1');
        const address = (
          app.getHttpServer() as Server
        ).address() as AddressInfo;
        process.send!({
          ready: true,
          baseUrl: `http://127.0.0.1:${address.port}`,
          users: ids,
          organizationId: org.id,
          otherOrganizationId: other.id,
        });
        if (!stop.signal.aborted)
          await new Promise<void>((resolve) =>
            stop.signal.addEventListener('abort', () => resolve(), {
              once: true,
            }),
          );
      } finally {
        await app.close();
      }
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    clearTimeout(timer);
    await real.onApplicationShutdown();
  }
}
void main()
  .then(() => {
    if (process.connected) process.disconnect();
  })
  .catch(() => {
    // Never send raw database/configuration exceptions or environment values to IPC/logs.
    if (process.connected) {
      process.send!({
        error:
          'Core fixture failed. Check local PostgreSQL and Core environment.',
      });
      process.disconnect();
    }
    process.exitCode = 1;
  });
