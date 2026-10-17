import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentActor, Operation } from '../common/context';
import type { Actor } from '../common/context';
import { CreateConnectorSourceDto, OrganizationQuery } from '../common/dto';
import { SourcesService } from './sources.service';

@Controller('data-sources')
export class SourcesController {
  constructor(private readonly service: SourcesService) {}
  @Post('connector') @Operation('analytics.sources.manage', 'data_source')
  create(@CurrentActor() actor: Actor, @Query() query: OrganizationQuery, @Body() body: CreateConnectorSourceDto) {
    return this.service.createConnector(actor, query.organizationId, body);
  }
  @Get() @Operation('analytics.sources.manage', 'data_source')
  list(@CurrentActor() actor: Actor, @Query() query: OrganizationQuery) { return this.service.list(actor, query.organizationId); }
  @Get(':id') @Operation('analytics.sources.manage', 'data_source')
  get(@CurrentActor() actor: Actor, @Query() query: OrganizationQuery, @Param('id', ParseUUIDPipe) id: string) { return this.service.get(actor, query.organizationId, id); }
  @Post(':id/archive') @Operation('analytics.sources.manage', 'data_source')
  archive(@CurrentActor() actor: Actor, @Query() query: OrganizationQuery, @Param('id', ParseUUIDPipe) id: string) { return this.service.archive(actor, query.organizationId, id); }
}
