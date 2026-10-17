import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CurrentActor, Operation } from '../common/context';
import type { Actor } from '../common/context';
import { OrganizationQuery } from '../common/dto';
import { VersionsService } from './versions.service';
@Controller('datasets/:datasetId/versions')
export class VersionsController {
  constructor(private readonly service: VersionsService) {}
  @Get() @Operation('analytics.datasets.read', 'dataset')
  list(@CurrentActor() actor: Actor, @Query() query: OrganizationQuery, @Param('datasetId', ParseUUIDPipe) datasetId: string) { return this.service.list(actor, query.organizationId, datasetId); }
  @Get(':id') @Operation('analytics.datasets.read', 'dataset')
  get(@CurrentActor() actor: Actor, @Query() query: OrganizationQuery, @Param('datasetId', ParseUUIDPipe) datasetId: string, @Param('id', ParseUUIDPipe) id: string) { return this.service.get(actor, query.organizationId, datasetId, id); }
}
