import { sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database';
import type { KnowledgeAuthorizationResponse } from '@amani/contracts';
import {
  Body,
  ForbiddenException,
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
  KnowledgeAuthorizationDto,
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
    private readonly database: DatabaseService,
  ) {}
  /** Policy projection for Knowledge, never document ACL ownership. */
  @Post('knowledge/authorization')
  @Operation('authorization.check', 'policy')
  async knowledge(
    @CurrentActor() actor: Actor,
    @Body() body: KnowledgeAuthorizationDto,
  ): Promise<KnowledgeAuthorizationResponse> {
    return this.database.transaction(async (tx) => {
      await this.policy.lockOrganization(tx, body.organizationId);
      const decision = await this.policy.check(
        actor,
        body.organizationId,
        body.permission,
        'knowledge',
        tx,
      );
      if (!decision.allowed) throw new ForbiddenException();
      const current = await tx.execute<{ id: string }>(sql`
        SELECT id FROM core_platform.memberships WHERE organization_id = ${body.organizationId}
        AND user_id = ${actor.userId} AND status = 'active'`);
      if (!current.rows[0]) throw new ForbiddenException();
      if (body.subjectMembershipId) {
        if (body.permission !== 'plugins.manage')
          throw new ForbiddenException();
        const subject = await tx.execute<{ id: string }>(sql`
          SELECT m.id FROM core_platform.memberships m
          JOIN core_platform.users u ON u.id = m.user_id AND u.status = 'active'
          WHERE m.organization_id = ${body.organizationId} AND m.id = ${body.subjectMembershipId}
          AND m.status = 'active'`);
        if (!subject.rows[0]) throw new ForbiddenException();
      }
      return {
        decision,
        membershipId: current.rows[0].id,
        ...(body.subjectMembershipId
          ? { subjectMembershipId: body.subjectMembershipId }
          : {}),
      };
    });
  }
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
