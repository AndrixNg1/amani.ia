import { Injectable, Module } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Session } from '../database/database';

@Injectable()
export class EntitlementsService {
  async allows(
    db: Session,
    organizationId: string,
    capability: string,
  ): Promise<boolean> {
    const result = await db.execute<{ allowed: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM core_platform.organization_subscriptions s
        JOIN core_platform.plans p ON p.id = s.plan_id AND p.status = 'active'
        JOIN core_platform.plan_entitlements e ON e.plan_id = p.id
        JOIN core_platform.organizations o ON o.id = s.organization_id AND o.status = 'active'
        WHERE s.organization_id = ${organizationId} AND s.status IN ('active','trial')
          AND s.starts_at <= now() AND (s.ends_at IS NULL OR s.ends_at > now())
          AND e.capability = ${capability} AND e.enabled
      ) AS allowed`);
    return result.rows[0]?.allowed === true;
  }
}
@Module({ providers: [EntitlementsService], exports: [EntitlementsService] })
export class EntitlementsModule {}
