import {
  BadRequestException,
  Injectable,
  Module,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseModule, DatabaseService } from '../database/database';
import { plans, subscriptions, organizations } from '../database/schema';
import {
  AuthorizationModule,
  AuthorizationService,
} from '../authorization/authorization.service';
import { AuditModule, AuditService } from '../audit/audit.service';
import { assertScope } from '../common/context';
import type { Actor } from '../common/context';

@Injectable()
export class PlansService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: AuthorizationService,
    private readonly audit: AuditService,
  ) {}
  async list(actor: Actor) {
    await this.policy.activeUser(this.database.db, actor.userId);
    return this.database.db
      .select()
      .from(plans)
      .where(eq(plans.status, 'active'))
      .orderBy(plans.id)
      .limit(100);
  }
  // Trusted platform service foundation; no tenant HTTP route can grant a paid plan.
  async setSubscription(
    actor: Actor,
    organizationId: string,
    planId: string,
    status: 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled',
  ) {
    assertScope(actor, organizationId);
    if (
      !['trial', 'active', 'past_due', 'suspended', 'cancelled'].includes(
        status,
      )
    )
      throw new BadRequestException();
    return this.database.transaction(async (tx) => {
      await this.policy.lockOrganization(tx, organizationId);
      await this.policy.platformAdmin(tx, actor);
      const [organization] = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId));
      const [plan] = await tx.select().from(plans).where(eq(plans.id, planId));
      if (!organization || !plan || plan.status !== 'active')
        throw new NotFoundException();
      const [subscription] = await tx
        .insert(subscriptions)
        .values({ organizationId, planId, status })
        .onConflictDoUpdate({
          target: subscriptions.organizationId,
          set: { planId, status, updatedAt: new Date() },
        })
        .returning();
      await this.audit.record(
        tx,
        actor,
        organizationId,
        'subscription.updated',
        'subscription',
        subscription.id,
        { status },
      );
      return subscription;
    });
  }
}
@Module({
  imports: [DatabaseModule, AuthorizationModule, AuditModule],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
