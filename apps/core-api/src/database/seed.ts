import { eq, and } from 'drizzle-orm';
import type { Session } from './database';
import {
  plugins,
  pluginVersions,
  permissions,
  plans,
  planEntitlements,
} from './schema';
import type { PluginName } from '@amani/types';

const official: readonly {
  key: PluginName;
  name: string;
  permission: string;
}[] = [
  {
    key: 'knowledge',
    name: 'Knowledge',
    permission: 'knowledge.documents.read',
  },
  {
    key: 'data-analytics',
    name: 'Data Analytics',
    permission: 'analytics.datasets.read',
  },
  {
    key: 'conversations',
    name: 'Conversations',
    permission: 'conversations.read',
  },
  { key: 'connectors', name: 'Connectors', permission: 'connectors.read' },
  { key: 'evaluation', name: 'Evaluation', permission: 'evaluation.runs.read' },
];
export async function seedDevelopment(db: Session) {
  // Additive and explicit. Never update/reactivate existing catalog or plan entries.
  await db
    .insert(plans)
    .values({
      key: 'development-all',
      name: 'Synthetic development plan (no billing)',
    })
    .onConflictDoNothing();
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.key, 'development-all'));
  for (const entry of official) {
    await db
      .insert(plugins)
      .values({
        key: entry.key,
        name: entry.name,
        description:
          'Official API metadata; business service not provisioned by this seed.',
      })
      .onConflictDoNothing();
    const [plugin] = await db
      .select()
      .from(plugins)
      .where(eq(plugins.key, entry.key));
    await db
      .insert(pluginVersions)
      .values({ pluginId: plugin.id, version: '0.1.0-dev', apiVersion: '1' })
      .onConflictDoNothing();
    await db
      .insert(permissions)
      .values({
        key: entry.permission,
        description: `${entry.name} organization capability; resource ACL still required`,
        pluginKey: entry.key,
      })
      .onConflictDoNothing();
    const [existing] = await db
      .select()
      .from(permissions)
      .where(eq(permissions.key, entry.permission));
    if (existing.pluginKey !== entry.key)
      throw new Error('Conflicting permission catalog');
    const entitlement = await db
      .select()
      .from(planEntitlements)
      .where(
        and(
          eq(planEntitlements.planId, plan.id),
          eq(planEntitlements.capability, `plugin:${entry.key}`),
        ),
      );
    if (!entitlement.length)
      await db
        .insert(planEntitlements)
        .values({ planId: plan.id, capability: `plugin:${entry.key}` })
        .onConflictDoNothing();
  }
}
