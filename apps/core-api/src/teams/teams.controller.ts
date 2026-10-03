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
import { CreateTeamDto, MemberReferenceDto } from '../common/dto';
import { TeamsService } from './teams.service';
@Controller('organizations/:organizationId/teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}
  @Get()
  @Operation('teams.read', 'team')
  list(
    @CurrentActor() actor: Actor,
    @Param('organizationId', ParseUUIDPipe) org: string,
  ) {
    return this.teams.list(actor, org);
  }
  @Post()
  @Operation('teams.manage', 'team')
  create(
    @CurrentActor() actor: Actor,
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Body() body: CreateTeamDto,
  ) {
    return this.teams.create(actor, org, body);
  }
  @Post(':id/members')
  @Operation('teams.manage', 'team')
  add(
    @CurrentActor() actor: Actor,
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MemberReferenceDto,
  ) {
    return this.teams.setMember(actor, org, id, body.membershipId);
  }
  @Delete(':id/members/:membershipId')
  @Operation('teams.manage', 'team')
  remove(
    @CurrentActor() actor: Actor,
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('membershipId', ParseUUIDPipe) member: string,
  ) {
    return this.teams.setMember(actor, org, id, member, true);
  }
}
