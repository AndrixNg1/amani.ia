import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentActor, Operation } from '../common/context';
import type { Actor } from '../common/context';
import {
  AuthorizationCheckDto,
  OrganizationQuery,
  PluginKeyParam,
} from '../common/dto';
import { AuthorizationService } from './authorization.service';
import { MembershipsService } from '../memberships/memberships.service';
@Controller('internal')
export class PolicyController {
  constructor(
    private readonly policy: AuthorizationService,
    private readonly memberships: MembershipsService,
  ) {}
  @Post('authorization/check')
  @Operation('authorization.check', 'policy')
  check(@CurrentActor() actor: Actor, @Body() body: AuthorizationCheckDto) {
    return this.policy.check(
      actor,
      body.organizationId,
      body.permission,
      body.pluginKey,
    );
  }
  @Get('authorization/effective-permissions')
  @Operation('authorization.read', 'policy')
  async effective(
    @CurrentActor() actor: Actor,
    @Query() query: OrganizationQuery,
  ) {
    return {
      organizationId: query.organizationId,
      userId: actor.userId,
      permissions: await this.policy.effective(actor, query.organizationId),
    };
  }
  @Get('organizations/:organizationId/memberships/:id')
  @Operation('members.read', 'membership')
  membership(
    @CurrentActor() actor: Actor,
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Param('id', ParseUUIDPipe) user: string,
  ) {
    return this.memberships.get(actor, org, user);
  }
  @Get('plugins/:pluginKey/access')
  @Operation('authorization.read', 'policy')
  access(
    @CurrentActor() actor: Actor,
    @Query() query: OrganizationQuery,
    @Param() param: PluginKeyParam,
  ) {
    return this.policy.check(
      actor,
      query.organizationId,
      'plugins.use',
      param.pluginKey,
    );
  }
}
