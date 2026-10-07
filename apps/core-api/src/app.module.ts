import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_GUARD } from '@nestjs/core';
import { IdentityVerifier, TrustedIdentityGuard } from './common/context';
import { identityVerifier } from './common/development-identity';
import { DatabaseModule } from './database/database';
import { AuthorizationModule } from './authorization/authorization.service';
import { OrganizationsModule } from './organizations/organizations.service';
import { MembershipsModule } from './memberships/memberships.service';
import { RolesModule } from './roles/roles.service';
import { TeamsModule } from './teams/teams.service';
import { UsersModule } from './users/users.service';
import { PluginsModule } from './plugins/plugins.service';
import { PlansModule } from './plans/plans.service';
import { PermissionsModule } from './permissions/permissions.service';
import { AuditModule } from './audit/audit.service';
import { UsersController } from './users/users.controller';
import { OrganizationsController } from './organizations/organizations.controller';
import { MembershipsController } from './memberships/memberships.controller';
import { RolesController } from './roles/roles.controller';
import { TeamsController } from './teams/teams.controller';
import { PluginsController } from './plugins/plugins.controller';
import { CatalogController } from './plans/catalog.controller';
import { PolicyController } from './authorization/policy.controller';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    DatabaseModule,
    AuthorizationModule,
    OrganizationsModule,
    MembershipsModule,
    RolesModule,
    TeamsModule,
    UsersModule,
    PluginsModule,
    PlansModule,
    PermissionsModule,
    AuditModule,
  ],
  controllers: [
    AppController,
    HealthController,
    UsersController,
    OrganizationsController,
    MembershipsController,
    RolesController,
    TeamsController,
    PluginsController,
    CatalogController,
    PolicyController,
  ],
  providers: [
    AppService,
    { provide: IdentityVerifier, useFactory: () => identityVerifier() },
    { provide: APP_GUARD, useClass: TrustedIdentityGuard },
  ],
})
export class AppModule {}
