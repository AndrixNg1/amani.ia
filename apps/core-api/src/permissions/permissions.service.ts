import { Injectable, Module } from '@nestjs/common';
import { DatabaseModule, DatabaseService } from '../database/database';
import { permissions } from '../database/schema';
import {
  AuthorizationModule,
  AuthorizationService,
} from '../authorization/authorization.service';
import type { Actor } from '../common/context';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: AuthorizationService,
  ) {}
  async list(actor: Actor, organizationId: string) {
    await this.policy.require(
      this.database.db,
      actor,
      organizationId,
      'roles.read',
    );
    return this.database.db
      .select({
        key: permissions.key,
        description: permissions.description,
        pluginKey: permissions.pluginKey,
      })
      .from(permissions)
      .orderBy(permissions.key)
      .limit(200);
  }
}
@Module({
  imports: [DatabaseModule, AuthorizationModule],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
