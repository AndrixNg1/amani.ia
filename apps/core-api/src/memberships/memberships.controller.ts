import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentActor, Operation } from '../common/context';
import type { Actor } from '../common/context';
import { MembershipStatusDto, UserReferenceDto } from '../common/dto';
import { MembershipsService } from './memberships.service';
@Controller('organizations/:organizationId/memberships')
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}
  @Post()
  @Operation('members.manage', 'membership')
  create(
    @CurrentActor() actor: Actor,
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Body() body: UserReferenceDto,
  ) {
    return this.memberships.create(actor, org, body.userId);
  }
  @Get('by-user/:id')
  @Operation('members.read', 'membership')
  get(
    @CurrentActor() actor: Actor,
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Param('id', ParseUUIDPipe) user: string,
  ) {
    return this.memberships.get(actor, org, user);
  }
  @Patch(':id')
  @Operation('members.manage', 'membership')
  status(
    @CurrentActor() actor: Actor,
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MembershipStatusDto,
  ) {
    return this.memberships.setStatus(actor, org, id, body.status);
  }
}
