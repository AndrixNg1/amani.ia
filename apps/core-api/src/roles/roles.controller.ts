import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CurrentActor, Operation } from '../common/context';
import type { Actor } from '../common/context';
import { CreateRoleDto, PermissionDto, RoleReferenceDto } from '../common/dto';
import { RolesService } from './roles.service';
@Controller('organizations/:organizationId')
export class RolesController {
  constructor(private readonly roles: RolesService) {}
  @Get('roles')
  @Operation('roles.read', 'role')
  list(
    @CurrentActor() actor: Actor,
    @Param('organizationId', ParseUUIDPipe) org: string,
  ) {
    return this.roles.list(actor, org);
  }
  @Post('roles')
  @Operation('roles.manage', 'role')
  create(
    @CurrentActor() actor: Actor,
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Body() body: CreateRoleDto,
  ) {
    return this.roles.create(actor, org, body);
  }
  @Post('roles/:id/permissions')
  @Operation('roles.manage', 'role')
  grant(
    @CurrentActor() actor: Actor,
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PermissionDto,
  ) {
    return this.roles.grant(actor, org, id, body.permission);
  }
  @Delete('roles/:id/permissions')
  @Operation('roles.manage', 'role')
  revoke(
    @CurrentActor() actor: Actor,
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PermissionDto,
  ) {
    return this.roles.grant(actor, org, id, body.permission, true);
  }
  @Post('memberships/:id/roles')
  @Operation('roles.manage', 'membership')
  assign(
    @CurrentActor() actor: Actor,
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RoleReferenceDto,
  ) {
    return this.roles.assign(actor, org, id, body.roleId);
  }
  @Delete('memberships/:id/roles/:roleId')
  @Operation('roles.manage', 'membership')
  unassign(
    @CurrentActor() actor: Actor,
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) role: string,
  ) {
    return this.roles.assign(actor, org, id, role, true);
  }
}
