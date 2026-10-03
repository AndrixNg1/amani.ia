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
import { CreateOrganizationDto, NameDto } from '../common/dto';
import { OrganizationsService } from './organizations.service';
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}
  @Post()
  @Operation('organization.create', 'organization')
  create(@CurrentActor() actor: Actor, @Body() body: CreateOrganizationDto) {
    return this.organizations.create(actor, body);
  }
  @Get(':organizationId')
  @Operation('organization.read', 'organization')
  get(
    @CurrentActor() actor: Actor,
    @Param('organizationId', ParseUUIDPipe) org: string,
  ) {
    return this.organizations.get(actor, org);
  }
  @Patch(':organizationId')
  @Operation('organization.manage', 'organization')
  update(
    @CurrentActor() actor: Actor,
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Body() body: NameDto,
  ) {
    return this.organizations.update(actor, org, body.name);
  }
}
