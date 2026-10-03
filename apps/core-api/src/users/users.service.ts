import { Injectable, Module, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseModule, DatabaseService } from '../database/database';
import { users } from '../database/schema';
import {
  AuthorizationModule,
  AuthorizationService,
} from '../authorization/authorization.service';
import { AuditModule, AuditService } from '../audit/audit.service';
import type { Actor } from '../common/context';

@Injectable()
export class UsersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: AuthorizationService,
    private readonly audit: AuditService,
  ) {}
  async create(actor: Actor, input: { email: string; displayName: string }) {
    return this.database.transaction(async (tx) => {
      await this.policy.platformAdmin(tx, actor);
      const [user] = await tx
        .insert(users)
        .values({
          email: input.email.trim().toLowerCase(),
          displayName: input.displayName.trim(),
        })
        .returning();
      await this.audit.record(tx, actor, null, 'user.created', 'user', user.id);
      return user;
    });
  }
  async get(actor: Actor, userId: string) {
    await this.policy.activeUser(this.database.db, actor.userId);
    if (actor.userId !== userId)
      await this.policy.platformAdmin(this.database.db, actor);
    const [user] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    if (!user) throw new NotFoundException();
    return user;
  }
  async updateSelf(actor: Actor, displayName: string) {
    return this.database.transaction(async (tx) => {
      await this.policy.activeUser(tx, actor.userId);
      const [user] = await tx
        .update(users)
        .set({ displayName: displayName.trim(), updatedAt: new Date() })
        .where(eq(users.id, actor.userId))
        .returning();
      await this.audit.record(tx, actor, null, 'user.updated', 'user', user.id);
      return user;
    });
  }
}
@Module({
  imports: [DatabaseModule, AuthorizationModule, AuditModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
