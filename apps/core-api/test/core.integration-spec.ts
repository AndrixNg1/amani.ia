import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { and, eq, sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database';
import type { Transaction } from '../src/database/database';
import * as schema from '../src/database/schema';
import { migrateInTransaction } from '../src/database/migrate';
import { seedDevelopment } from '../src/database/seed';
import { coreConfig, loadLocalEnvironment } from '../src/common/config';
import { IdentityVerifier } from '../src/common/context';
import type { Actor, VerifiedIdentity } from '../src/common/context';
import { configureHttp } from '../src/common/http';
import type {
  OrganizationId,
  UserId,
  CorrelationId,
  ResourceId,
} from '@amani/types';
import { OrganizationsService } from '../src/organizations/organizations.service';
import { MembershipsService } from '../src/memberships/memberships.service';
import { RolesService } from '../src/roles/roles.service';
import { TeamsService } from '../src/teams/teams.service';
import { UsersService } from '../src/users/users.service';
import { AuthorizationService } from '../src/authorization/authorization.service';
import { AuditService } from '../src/audit/audit.service';
import { PluginsService } from '../src/plugins/plugins.service';
import { PlansService } from '../src/plans/plans.service';

describe('Core domain with real PostgreSQL and transaction rollback', () => {
  let real: DatabaseService;
  let db: Transaction;
  let finish: () => void;
  let completed: Promise<unknown>;
  let app: INestApplication<App>;
  let organizations: OrganizationsService;
  let memberships: MembershipsService;
  let roles: RolesService;
  let teams: TeamsService;
  let users: UsersService;
  let policy: AuthorizationService;
  let audit: AuditService;
  let plugins: PluginsService;
  let plans: PlansService;
  let identity: VerifiedIdentity | null = null;
  let owner: Actor;
  let otherOwner: Actor;
  let memberActor: Actor;
  let platform: Actor;
  let org: string;
  let otherOrg: string;
  let member: typeof schema.memberships.$inferSelect;
  const rollback = new Error('rollback synthetic fixtures');
  const actor = (userId: string, organizationId?: string): Actor => ({
    userId: userId as UserId,
    organizationId: organizationId as OrganizationId | undefined,
    correlationId: randomUUID() as CorrelationId,
  });

  beforeAll(async () => {
    loadLocalEnvironment();
    if (process.env.CORE_DB_TESTS !== 'true')
      throw new Error(
        'Set CORE_DB_TESTS=true explicitly; integration tests never silently skip.',
      );
    if (!['development', 'test'].includes(coreConfig().environment))
      throw new Error('Integration tests refused outside development/test');
    real = new DatabaseService();
    db = await new Promise<Transaction>((resolve, reject) => {
      completed = real.db
        .transaction(async (tx) => {
          await migrateInTransaction(tx);
          await seedDevelopment(tx);
          finish = () => {};
          const held = new Promise<void>((release) => {
            finish = release;
          });
          resolve(tx);
          await held;
          throw rollback;
        })
        .catch((error: unknown) => {
          if (error !== rollback) {
            reject(
              error instanceof Error
                ? error
                : new Error('Database test setup failed'),
            );
            throw error;
          }
        });
      // Observe setup rejection immediately; completion is also awaited in teardown.
      void completed.catch(() => {});
    });
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue({
        db,
        transaction: <T>(work: (tx: Transaction) => Promise<T>) =>
          db.transaction(work),
        ready: () => Promise.resolve(),
      })
      .overrideProvider(IdentityVerifier)
      .useValue({ verify: () => Promise.resolve(identity) })
      .compile();
    app = fixture.createNestApplication();
    configureHttp(app);
    await app.init();
    organizations = app.get(OrganizationsService);
    memberships = app.get(MembershipsService);
    roles = app.get(RolesService);
    teams = app.get(TeamsService);
    users = app.get(UsersService);
    policy = app.get(AuthorizationService);
    audit = app.get(AuditService);
    plugins = app.get(PluginsService);
    plans = app.get(PlansService);
  });
  beforeEach(async () => {
    identity = null;
    const accounts = await db
      .insert(schema.users)
      .values(
        ['owner', 'other', 'member', 'platform'].map((name) => ({
          email: `${name}-${randomUUID()}@example.invalid`,
          displayName: name,
        })),
      )
      .returning();
    owner = actor(accounts[0].id);
    otherOwner = actor(accounts[1].id);
    memberActor = actor(accounts[2].id);
    platform = actor(accounts[3].id);
    const [platformRole] = await db
      .select()
      .from(schema.platformRoles)
      .where(eq(schema.platformRoles.key, 'platform_admin'));
    await db
      .insert(schema.userPlatformRoles)
      .values({ userId: platform.userId, roleId: platformRole.id });
    const first = await organizations.create(owner, {
      name: 'Synthetic A',
      slug: `test-${randomUUID()}`,
    });
    const second = await organizations.create(otherOwner, {
      name: 'Synthetic B',
      slug: `test-${randomUUID()}`,
    });
    org = first.id;
    otherOrg = second.id;
    owner = actor(owner.userId, org);
    otherOwner = actor(otherOwner.userId, otherOrg);
    memberActor = actor(memberActor.userId, org);
    platform = actor(platform.userId, org);
    member = await memberships.create(owner, org, memberActor.userId);
  });
  afterAll(async () => {
    if (app) await app.close();
    if (finish) finish();
    try {
      if (completed !== undefined) await completed;
    } finally {
      if (real) await real.onApplicationShutdown();
    }
  });

  it('persists organization, unique owner and three system roles atomically', async () => {
    const ownerMembership = await memberships.get(owner, org, owner.userId);
    const defaults = await roles.list(owner, org);
    expect(defaults.map((r) => r.name).sort()).toEqual([
      'admin',
      'member',
      'owner',
    ]);
    const links = await db
      .select()
      .from(schema.membershipRoles)
      .where(
        and(
          eq(schema.membershipRoles.organizationId, org),
          eq(schema.membershipRoles.membershipId, ownerMembership.id),
        ),
      );
    expect(links).toHaveLength(1);
    expect(links[0].roleId).toBe(defaults.find((r) => r.name === 'owner')!.id);
    const existing = await organizations.get(owner, org);
    await expect(
      organizations.create(owner, { name: 'Duplicate', slug: existing.slug }),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
    expect(await policy.effective(owner, org)).toContain('roles.manage');
  });
  it('enforces one membership per organization/user and allows membership in another organization', async () => {
    await expect(
      memberships.create(owner, org, memberActor.userId),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
    await expect(
      memberships.create(otherOwner, otherOrg, memberActor.userId),
    ).resolves.toMatchObject({ organizationId: otherOrg });
  });
  it('creates normalized unique users without password fields; tenant owner cannot create global identities', async () => {
    const email = `Test-${randomUUID()}@example.invalid`;
    const user = await users.create(platform, {
      email,
      displayName: 'Synthetic account',
    });
    expect(user.email).toBe(email.toLowerCase());
    expect(user).not.toHaveProperty('password');
    await expect(
      users.create(platform, {
        email: email.toLowerCase(),
        displayName: 'Duplicate',
      }),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
    await expect(
      users.create(owner, {
        email: 'rejected@example.invalid',
        displayName: 'Rejected',
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('denies by default, resolves multiple custom roles, and immediately removes revoked permissions', async () => {
    expect(
      (await policy.check(memberActor, org, 'organization.read')).allowed,
    ).toBe(false);
    const reader = await roles.create(owner, org, { name: 'reader' });
    const colleague = await roles.create(owner, org, { name: 'colleague' });
    await roles.grant(owner, org, reader.id, 'organization.read');
    await roles.grant(owner, org, colleague.id, 'teams.read');
    await roles.assign(owner, org, member.id, reader.id);
    await roles.assign(owner, org, member.id, colleague.id);
    expect(await policy.effective(memberActor, org)).toEqual([
      'organization.read',
      'teams.read',
    ]);
    expect(
      (await policy.check(memberActor, org, 'organization.read')).reason,
    ).toBe('ROLE_PERMISSION');
    await roles.grant(owner, org, reader.id, 'organization.read', true);
    expect(
      (await policy.check(memberActor, org, 'organization.read')).allowed,
    ).toBe(false);
  });
  it('denies inactive memberships and suspended users/organizations', async () => {
    const reader = await roles.create(owner, org, { name: 'reader' });
    await roles.grant(owner, org, reader.id, 'organization.read');
    await roles.assign(owner, org, member.id, reader.id);
    await memberships.setStatus(owner, org, member.id, 'inactive');
    expect(
      (await policy.check(memberActor, org, 'organization.read')).reason,
    ).toBe('INACTIVE_CONTEXT');
    await memberships.setStatus(owner, org, member.id, 'active');
    await db
      .update(schema.users)
      .set({ status: 'suspended' })
      .where(eq(schema.users.id, memberActor.userId));
    expect(await policy.effective(memberActor, org)).toEqual([]);
    await db
      .update(schema.organizations)
      .set({ status: 'suspended' })
      .where(eq(schema.organizations.id, org));
    expect((await policy.check(owner, org, 'organization.read')).allowed).toBe(
      false,
    );
  });
  it('rejects foreign role IDs, wrong tenant context, and direct composite-FK attacks', async () => {
    const foreign = await roles.create(otherOwner, otherOrg, {
      name: 'foreign-role',
    });
    await expect(
      roles.grant(owner, org, foreign.id, 'organization.read'),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      roles.assign(owner, org, member.id, foreign.id),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (await policy.check(owner, otherOrg, 'organization.read')).reason,
    ).toBe('WRONG_ORGANIZATION');
    expect(
      (
        await policy.check(
          actor(owner.userId, otherOrg),
          otherOrg,
          'organization.read',
        )
      ).allowed,
    ).toBe(false);
    await expect(
      db.transaction((tx) =>
        tx.insert(schema.membershipRoles).values({
          organizationId: org,
          membershipId: member.id,
          roleId: foreign.id,
        }),
      ),
    ).rejects.toMatchObject({ cause: { code: '23503' } });
  });
  it('prevents admin escalation and protects owner assignment, status and baseline permissions', async () => {
    const defaults = await roles.list(owner, org);
    const admin = defaults.find((r) => r.name === 'admin')!;
    const ownerRole = defaults.find((r) => r.name === 'owner')!;
    await roles.assign(owner, org, member.id, admin.id);
    const custom = await roles.create(memberActor, org, { name: 'delegated' });
    await expect(
      roles.grant(memberActor, org, custom.id, 'knowledge.documents.read'),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      roles.assign(memberActor, org, member.id, ownerRole.id),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      roles.grant(owner, org, ownerRole.id, 'roles.manage', true),
    ).rejects.toMatchObject({ status: 403 });
    const ownerMembership = await memberships.get(owner, org, owner.userId);
    await expect(
      memberships.setStatus(owner, org, ownerMembership.id, 'inactive'),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      roles.assign(owner, org, ownerMembership.id, ownerRole.id, true),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('does not give platform administrators implicit membership or tenant permissions', async () => {
    expect(await policy.effective(platform, org)).toEqual([]);
    await expect(organizations.get(platform, org)).rejects.toMatchObject({
      status: 403,
    });
  });
  it('isolates team references and does not implicitly inherit permissions through teams', async () => {
    const team = await teams.create(owner, org, { name: 'Research' });
    await teams.setMember(owner, org, team.id, member.id);
    expect(await policy.effective(memberActor, org)).toEqual([]);
    const foreign = await teams.create(otherOwner, otherOrg, {
      name: 'Foreign',
    });
    await expect(
      teams.setMember(owner, org, foreign.id, member.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      db.transaction((tx) =>
        tx.insert(schema.teamMemberships).values({
          organizationId: org,
          teamId: foreign.id,
          membershipId: member.id,
        }),
      ),
    ).rejects.toMatchObject({ cause: { code: '23503' } });
  });
  it('rolls onboarding back if the final audit write fails', async () => {
    const slug = `rollback-${randomUUID()}`;
    const failure = jest
      .spyOn(audit, 'record')
      .mockRejectedValueOnce(new Error('synthetic audit failure'));
    try {
      await expect(
        organizations.create(owner, { name: 'Must rollback', slug }),
      ).rejects.toThrow('synthetic audit failure');
    } finally {
      failure.mockRestore();
    }
    expect(
      await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.slug, slug)),
    ).toHaveLength(0);
  });
  it('records allowlisted audit metadata and scopes reads to the organization', async () => {
    await roles.create(owner, org, {
      name: 'audited',
      description: 'private-description-not-for-audit',
    });
    const events = await audit.list(owner, org);
    expect(
      events.some(
        (e) =>
          e.action === 'role.created' &&
          e.actorUserId === owner.userId &&
          e.correlationId === owner.correlationId,
      ),
    ).toBe(true);
    expect(events.every((e) => e.organizationId === org)).toBe(true);
    expect(JSON.stringify(events)).not.toContain(
      'private-description-not-for-audit',
    );
    await expect(audit.list(owner, otherOrg)).rejects.toMatchObject({
      status: 403,
    });
  });

  async function activePlugin() {
    const catalog = await plugins.catalog(owner, 'knowledge');
    const plan = (await plans.list(owner)).find(
      (p) => p.key === 'development-all',
    )!;
    await plans.setSubscription(platform, org, plan.id, 'active');
    const installation = await plugins.request(
      owner,
      org,
      'knowledge',
      catalog.versions[0].id,
    );
    await plugins.transition(platform, org, installation.id, 'provisioning');
    await plugins.transition(platform, org, installation.id, 'active');
    return { installation, plan, catalog };
  }
  it('keeps catalog, entitlement, installation and user permissions separate', async () => {
    const catalog = await plugins.catalog(owner, 'knowledge');
    expect(catalog.key).toBe('knowledge');
    await expect(
      plugins.request(owner, org, 'knowledge', catalog.versions[0].id),
    ).rejects.toMatchObject({ status: 403 });
    const { installation } = await activePlugin();
    expect(
      (await policy.check(owner, org, 'plugins.use', 'knowledge')).allowed,
    ).toBe(true);
    expect(
      (await policy.check(memberActor, org, 'plugins.use', 'knowledge'))
        .allowed,
    ).toBe(false);
    expect(
      (await policy.check(otherOwner, otherOrg, 'plugins.use', 'knowledge'))
        .allowed,
    ).toBe(false);
    await expect(
      plugins.get(otherOwner, otherOrg, installation.id),
    ).rejects.toMatchObject({ status: 404 });
    const retry = await plugins.request(
      owner,
      org,
      'knowledge',
      catalog.versions[0].id,
    );
    expect(retry.id).toBe(installation.id);
  });
  it('rejects skipped lifecycle steps and tenant-admin activation of provisioning', async () => {
    const catalog = await plugins.catalog(owner, 'knowledge');
    const plan = (await plans.list(owner))[0];
    await expect(
      plans.setSubscription(owner, org, plan.id, 'active'),
    ).rejects.toMatchObject({ status: 403 });
    await plans.setSubscription(platform, org, plan.id, 'active');
    const installation = await plugins.request(
      owner,
      org,
      'knowledge',
      catalog.versions[0].id,
    );
    await expect(
      plugins.transition(platform, org, installation.id, 'active'),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      plugins.transition(owner, org, installation.id, 'provisioning'),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('removes plugin permissions after disable and subscription revocation', async () => {
    const { installation, plan } = await activePlugin();
    const reader = await roles.create(owner, org, { name: 'knowledge-reader' });
    await roles.grant(owner, org, reader.id, 'knowledge.documents.read');
    await roles.grant(owner, org, reader.id, 'plugins.use');
    await roles.assign(owner, org, member.id, reader.id);
    expect(await policy.effective(memberActor, org)).toContain(
      'knowledge.documents.read',
    );
    expect(
      (
        await policy.check(
          memberActor,
          org,
          'knowledge.documents.read',
          'data-analytics',
        )
      ).allowed,
    ).toBe(false);
    await plans.setSubscription(platform, org, plan.id, 'past_due');
    expect(
      (await policy.check(memberActor, org, 'knowledge.documents.read'))
        .allowed,
    ).toBe(false);
    await plans.setSubscription(platform, org, plan.id, 'active');
    await plugins.transition(owner, org, installation.id, 'disabled');
    expect(
      (await policy.check(memberActor, org, 'knowledge.documents.read')).reason,
    ).toBe('PLUGIN_UNAVAILABLE');
    expect(await policy.effective(memberActor, org)).not.toContain(
      'knowledge.documents.read',
    );
  });
  it('uses DTO validation and generic errors after a server-side test verifier establishes identity', async () => {
    identity = {
      userId: owner.userId,
      callingService: '@amani/gateway',
      audience: '@amani/core-api',
      scope: { action: 'organization.create', resourceType: 'organization' },
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    const server = app.getHttpServer();
    await request(server)
      .post('/organizations')
      .send({ name: ' ', slug: 'bad slug' })
      .expect(400);
    await request(server)
      .post('/organizations')
      .send({ name: 'Valid', slug: 'valid', userId: platform.userId })
      .expect(400);
    const existing = await organizations.get(owner, org);
    const duplicate = await request(server)
      .post('/organizations')
      .send({ name: 'Duplicate', slug: existing.slug })
      .expect(409);
    expect(duplicate.text).not.toContain('INSERT');
    expect(duplicate.text).not.toContain('constraint');
    const created = await request(server)
      .post('/organizations')
      .send({ name: 'HTTP fixture', slug: `http-${randomUUID()}` })
      .expect(201);
    expect(created.body).toMatchObject({
      name: 'HTTP fixture',
      status: 'active',
    });
  });
  it('binds authenticated delegation to audience, expiry, action and organization', async () => {
    const valid: VerifiedIdentity = {
      userId: owner.userId,
      organizationId: org as OrganizationId,
      callingService: '@amani/gateway',
      audience: '@amani/core-api',
      scope: { action: 'organization.read', resourceType: 'organization' },
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    identity = valid;
    await request(app.getHttpServer()).get(`/organizations/${org}`).expect(200);
    await request(app.getHttpServer())
      .get(`/organizations/${otherOrg}`)
      .expect(403);
    identity = { ...valid, expiresAt: new Date(0).toISOString() };
    await request(app.getHttpServer()).get(`/organizations/${org}`).expect(403);
    identity = {
      ...valid,
      scope: { action: 'roles.manage', resourceType: 'organization' },
    };
    await request(app.getHttpServer()).get(`/organizations/${org}`).expect(403);
    identity = { ...valid, audience: '@amani/knowledge' as '@amani/core-api' };
    await request(app.getHttpServer()).get(`/organizations/${org}`).expect(403);
  });
  it('makes migration and development seed replay idempotent without reactivating disabled metadata', async () => {
    await migrateInTransaction(db);
    await db
      .update(schema.plugins)
      .set({ status: 'disabled' })
      .where(eq(schema.plugins.key, 'evaluation'));
    await seedDevelopment(db);
    const [plugin] = await db
      .select()
      .from(schema.plugins)
      .where(eq(schema.plugins.key, 'evaluation'));
    expect(plugin.status).toBe('disabled');
    const count = await db.execute<{ count: string }>(
      sql`SELECT count(*) FROM core_platform.plugins WHERE key = 'evaluation'`,
    );
    expect(count.rows[0].count).toBe('1');
  });
  it('requires a target plugin and plugins.use in addition to a plugin-specific permission', async () => {
    await activePlugin();
    const reader = await roles.create(owner, org, { name: 'partial-reader' });
    await roles.grant(owner, org, reader.id, 'knowledge.documents.read');
    await roles.assign(owner, org, member.id, reader.id);
    expect(
      (await policy.check(memberActor, org, 'knowledge.documents.read')).reason,
    ).toBe('MISSING_PERMISSION');
    expect(await policy.effective(memberActor, org)).not.toContain(
      'knowledge.documents.read',
    );
    expect((await policy.check(owner, org, 'plugins.use')).allowed).toBe(false);
    expect((await policy.check(owner, org, 'unknown.permission')).allowed).toBe(
      false,
    );
  });
  it('denies future/expired subscriptions, disabled plans and globally disabled plugins', async () => {
    const { plan, catalog } = await activePlugin();
    const allowed = async () =>
      (await policy.check(owner, org, 'plugins.use', 'knowledge')).allowed;
    expect(await allowed()).toBe(true);
    await db
      .update(schema.subscriptions)
      .set({ startsAt: new Date(Date.now() + 86400000) })
      .where(eq(schema.subscriptions.organizationId, org));
    expect(await allowed()).toBe(false);
    await db
      .update(schema.subscriptions)
      .set({ startsAt: new Date(0), endsAt: new Date(1000) })
      .where(eq(schema.subscriptions.organizationId, org));
    expect(await allowed()).toBe(false);
    await db
      .update(schema.subscriptions)
      .set({ endsAt: null })
      .where(eq(schema.subscriptions.organizationId, org));
    await db
      .update(schema.plans)
      .set({ status: 'disabled' })
      .where(eq(schema.plans.id, plan.id));
    expect(await allowed()).toBe(false);
    await db
      .update(schema.plans)
      .set({ status: 'active' })
      .where(eq(schema.plans.id, plan.id));
    await db
      .update(schema.plugins)
      .set({ status: 'disabled' })
      .where(eq(schema.plugins.id, catalog.id));
    expect(await allowed()).toBe(false);
    await db
      .update(schema.plugins)
      .set({ status: 'available' })
      .where(eq(schema.plugins.id, catalog.id));
  });
  it('enforces installation uniqueness and version ownership in PostgreSQL', async () => {
    const { installation } = await activePlugin();
    const foreign = await plugins.catalog(owner, 'connectors');
    await expect(
      db.transaction((tx) =>
        tx.insert(schema.installations).values({
          organizationId: org,
          pluginId: installation.pluginId,
          versionId: installation.versionId,
        }),
      ),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
    await expect(
      db.transaction((tx) =>
        tx.insert(schema.installations).values({
          organizationId: otherOrg,
          pluginId: installation.pluginId,
          versionId: foreign.versions[0].id,
        }),
      ),
    ).rejects.toMatchObject({ cause: { code: '23503' } });
  });
  it('rejects modified migration checksums', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(
          sql`UPDATE core_platform.schema_migrations SET checksum = 'synthetic-invalid-checksum' WHERE name = '0001_core_platform.sql'`,
        );
        await migrateInTransaction(tx);
      }),
    ).rejects.toThrow('Applied migration checksum differs');
    await expect(migrateInTransaction(db)).resolves.toBeUndefined();
  });
  it('enforces resource and plugin restrictions from verified delegation', async () => {
    identity = {
      userId: owner.userId,
      organizationId: org as OrganizationId,
      callingService: '@amani/gateway',
      audience: '@amani/core-api',
      scope: {
        action: 'organization.read',
        resourceType: 'organization',
        resourceId: org as ResourceId,
      },
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    await request(app.getHttpServer()).get(`/organizations/${org}`).expect(200);
    identity = {
      ...identity,
      scope: { ...identity.scope, resourceId: otherOrg as ResourceId },
    };
    await request(app.getHttpServer()).get(`/organizations/${org}`).expect(403);
    identity = {
      ...identity,
      scope: {
        action: 'authorization.read',
        resourceType: 'policy',
        plugin: 'knowledge',
      },
    };
    await request(app.getHttpServer())
      .get(`/internal/plugins/knowledge/access?organizationId=${org}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/internal/plugins/connectors/access?organizationId=${org}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(
        `/internal/authorization/effective-permissions?organizationId=${org}`,
      )
      .expect(403);
  });
});
