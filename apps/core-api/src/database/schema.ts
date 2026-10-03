import {
  pgSchema,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import type { Metadata } from '@amani/types';

// Internal models only. SQL migrations are authoritative for constraints/indexes.
const core = pgSchema('core_platform');
const id = () => uuid('id').primaryKey().defaultRandom();
const dates = () => ({
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
const org = () => uuid('organization_id').notNull();
export const users = core.table('users', {
  id: id(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  status: text('status').notNull().default('active'),
  ...dates(),
});
export const organizations = core.table('organizations', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  status: text('status').notNull().default('active'),
  ...dates(),
});
export const memberships = core.table('memberships', {
  id: id(),
  organizationId: org(),
  userId: uuid('user_id').notNull(),
  status: text('status').notNull().default('active'),
  joinedAt: timestamp('joined_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  ...dates(),
});
export const teams = core.table('teams', {
  id: id(),
  organizationId: org(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  ...dates(),
});
export const teamMemberships = core.table('team_memberships', {
  id: id(),
  organizationId: org(),
  teamId: uuid('team_id').notNull(),
  membershipId: uuid('membership_id').notNull(),
  ...dates(),
});
export const roles = core.table('roles', {
  id: id(),
  organizationId: org(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  isSystem: boolean('is_system').notNull().default(false),
  ...dates(),
});
export const permissions = core.table('permissions', {
  id: id(),
  key: text('key').notNull(),
  description: text('description').notNull(),
  pluginKey: text('plugin_key'),
  ...dates(),
});
export const rolePermissions = core.table('role_permissions', {
  id: id(),
  organizationId: org(),
  roleId: uuid('role_id').notNull(),
  permissionId: uuid('permission_id').notNull(),
  ...dates(),
});
export const membershipRoles = core.table('membership_roles', {
  id: id(),
  organizationId: org(),
  membershipId: uuid('membership_id').notNull(),
  roleId: uuid('role_id').notNull(),
  ...dates(),
});
export const platformRoles = core.table('platform_roles', {
  id: id(),
  key: text('key').notNull(),
  description: text('description').notNull(),
  ...dates(),
});
export const userPlatformRoles = core.table('user_platform_roles', {
  id: id(),
  userId: uuid('user_id').notNull(),
  roleId: uuid('role_id').notNull(),
  ...dates(),
});
export const plugins = core.table('plugins', {
  id: id(),
  key: text('key').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('available'),
  ...dates(),
});
export const pluginVersions = core.table('plugin_versions', {
  id: id(),
  pluginId: uuid('plugin_id').notNull(),
  version: text('version').notNull(),
  apiVersion: text('api_version').notNull(),
  ...dates(),
});
export const installations = core.table('organization_plugin_installations', {
  id: id(),
  organizationId: org(),
  pluginId: uuid('plugin_id').notNull(),
  versionId: uuid('version_id').notNull(),
  status: text('status').notNull().default('requested'),
  installedAt: timestamp('installed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
  ...dates(),
});
export const plans = core.table('plans', {
  id: id(),
  key: text('key').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull().default('active'),
  ...dates(),
});
export const planEntitlements = core.table('plan_entitlements', {
  id: id(),
  planId: uuid('plan_id').notNull(),
  capability: text('capability').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  ...dates(),
});
export const subscriptions = core.table('organization_subscriptions', {
  id: id(),
  organizationId: org(),
  planId: uuid('plan_id').notNull(),
  status: text('status').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  ...dates(),
});
export const auditEvents = core.table('audit_events', {
  id: id(),
  organizationId: uuid('organization_id'),
  actorUserId: uuid('actor_user_id'),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: uuid('target_id').notNull(),
  correlationId: text('correlation_id').notNull(),
  outcome: text('outcome').notNull().default('success'),
  metadata: jsonb('metadata').$type<Metadata>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
