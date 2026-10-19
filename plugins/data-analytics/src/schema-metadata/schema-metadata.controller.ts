import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CurrentActor, Operation } from '../common/context';
import type { Actor } from '../common/context';
import { OrganizationQuery } from '../common/dto';
import { SchemaMetadataService } from './schema-metadata.service';
@Controller()
export class SchemaMetadataController {
  constructor(private readonly service: SchemaMetadataService) {}
  @Get('datasets/:datasetId/tables')
  @Operation('analytics.datasets.read', 'dataset')
  tables(
    @CurrentActor() actor: Actor,
    @Query() query: OrganizationQuery,
    @Param('datasetId', ParseUUIDPipe) datasetId: string,
  ) {
    return this.service.tables(actor, query.organizationId, datasetId);
  }
  @Get('dataset-tables/:tableId/columns')
  @Operation('analytics.datasets.read', 'dataset_table')
  columns(
    @CurrentActor() actor: Actor,
    @Query() query: OrganizationQuery,
    @Param('tableId', ParseUUIDPipe) tableId: string,
  ) {
    return this.service.columns(actor, query.organizationId, tableId);
  }
}
