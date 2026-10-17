import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentActor, Operation } from '../common/context';
import type { Actor } from '../common/context';
import { CreateDatasetDto, OrganizationQuery, UpdateDatasetDto } from '../common/dto';
import { DatasetsService } from './datasets.service';
@Controller('datasets')
export class DatasetsController {
  constructor(private readonly service: DatasetsService) {}
  @Post() @Operation('analytics.datasets.manage', 'dataset')
  create(@CurrentActor() actor: Actor, @Query() query: OrganizationQuery, @Body() body: CreateDatasetDto) { return this.service.create(actor, query.organizationId, body); }
  @Get() @Operation('analytics.datasets.read', 'dataset')
  list(@CurrentActor() actor: Actor, @Query() query: OrganizationQuery) { return this.service.list(actor, query.organizationId); }
  @Get(':id') @Operation('analytics.datasets.read', 'dataset')
  get(@CurrentActor() actor: Actor, @Query() query: OrganizationQuery, @Param('id', ParseUUIDPipe) id: string) { return this.service.get(actor, query.organizationId, id); }
  @Patch(':id') @Operation('analytics.datasets.manage', 'dataset')
  update(@CurrentActor() actor: Actor, @Query() query: OrganizationQuery, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateDatasetDto) { return this.service.update(actor, query.organizationId, id, body); }
  @Post(':id/archive') @Operation('analytics.datasets.manage', 'dataset')
  archive(@CurrentActor() actor: Actor, @Query() query: OrganizationQuery, @Param('id', ParseUUIDPipe) id: string) { return this.service.archive(actor, query.organizationId, id); }
}
