import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { CurrentActor, Operation } from '../common/context';
import type { Actor } from '../common/context';
import { PlansService } from './plans.service';
import { PermissionsService } from '../permissions/permissions.service';
import { AuditService } from '../audit/audit.service';
@Controller()
export class CatalogController {
  constructor(
    private readonly plans: PlansService,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditService,
  ) {}
  @Get('plans')
  @Operation('plans.read', 'plan')
  list(@CurrentActor() actor: Actor) {
    return this.plans.list(actor);
  }
  @Get('organizations/:organizationId/permissions')
  @Operation('roles.read', 'permission')
  permissionsList(
    @CurrentActor() actor: Actor,
    @Param('organizationId', ParseUUIDPipe) org: string,
  ) {
    return this.permissions.list(actor, org);
  }
  @Get('organizations/:organizationId/audit')
  @Operation('audit.read', 'audit_event')
  auditList(
    @CurrentActor() actor: Actor,
    @Param('organizationId', ParseUUIDPipe) org: string,
  ) {
    return this.audit.list(actor, org);
  }
}
