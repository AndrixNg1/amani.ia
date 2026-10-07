import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import type { PluginName } from '@amani/types';
import { CurrentContext } from '../common/context';
import type { RequestContext } from '../common/context';
import { AuthenticatedOnly, RequirePermission } from '../auth/guards';
import { CoreClient } from '../core-client/core-client';

export class CreateOrganizationDto {
  @IsString() @MaxLength(120) @Matches(/\S/) name!: string;
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
}
export class CreateMembershipDto {
  @IsUUID() userId!: string;
}
@Controller('api/platform')
export class PlatformController {
  constructor(private readonly core: CoreClient) {}
  @Get('me')
  @AuthenticatedOnly()
  me(@CurrentContext() ctx: RequestContext) {
    return this.core.me(ctx);
  }
  @Post('organizations')
  @AuthenticatedOnly()
  create(
    @CurrentContext() ctx: RequestContext,
    @Body() body: CreateOrganizationDto,
  ) {
    return this.core.createOrganization(ctx, {
      name: body.name,
      slug: body.slug,
    });
  }
  @Get('organizations/:organizationId')
  @RequirePermission('organization.read')
  organization(@CurrentContext() ctx: RequestContext) {
    return this.core.organization(ctx);
  }
  @Post('organizations/:organizationId/memberships')
  @RequirePermission('members.manage')
  createMembership(
    @CurrentContext() ctx: RequestContext,
    @Body() body: CreateMembershipDto,
  ) {
    return this.core.createMembership(ctx, body.userId.toLowerCase());
  }
  @Get('organizations/:organizationId/memberships/:userId')
  @RequirePermission('members.read')
  membership(
    @CurrentContext() ctx: RequestContext,
    @Param('userId') userId: string,
  ) {
    return this.core.membership(ctx, userId);
  }
  @Get('organizations/:organizationId/permissions')
  @RequirePermission('organization.read')
  permissions(@CurrentContext() ctx: RequestContext) {
    return this.core.permissions(ctx);
  }
  @Get('organizations/:organizationId/plugins/:pluginKey/access')
  @RequirePermission('organization.read')
  plugin(
    @CurrentContext() ctx: RequestContext,
    @Param('pluginKey') plugin: PluginName,
  ) {
    return this.core.pluginAccess(ctx, plugin);
  }
}
