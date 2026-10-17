import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentActor, Operation } from '../common/context';
import type { Actor } from '../common/context';
import { GrantDto, OrganizationQuery } from '../common/dto';
import { AccessService } from './access.service';
import type { ResourceType } from './resource-policy';

@Controller()
export class AccessController {
  constructor(private readonly service: AccessService) {}
  private listFor(type: ResourceType, actor: Actor, query: OrganizationQuery, id: string) { return this.service.list(actor, query.organizationId, type, id); }
  private grantFor(type: ResourceType, actor: Actor, query: OrganizationQuery, id: string, body: GrantDto) { return this.service.grant(actor, query.organizationId, type, id, body); }
  private revokeFor(type: ResourceType, actor: Actor, query: OrganizationQuery, id: string, grantId: string) { return this.service.revoke(actor, query.organizationId, type, id, grantId); }
  @Get('datasets/:id/access') @Operation('analytics.access.manage', 'dataset')
  listDataset(@CurrentActor() a: Actor, @Query() q: OrganizationQuery, @Param('id', ParseUUIDPipe) id: string) { return this.listFor('dataset', a, q, id); }
  @Post('datasets/:id/access') @Operation('analytics.access.manage', 'dataset')
  grantDataset(@CurrentActor() a: Actor, @Query() q: OrganizationQuery, @Param('id', ParseUUIDPipe) id: string, @Body() b: GrantDto) { return this.grantFor('dataset', a, q, id, b); }
  @Delete('datasets/:id/access/:grantId') @Operation('analytics.access.manage', 'dataset')
  revokeDataset(@CurrentActor() a: Actor, @Query() q: OrganizationQuery, @Param('id', ParseUUIDPipe) id: string, @Param('grantId', ParseUUIDPipe) grantId: string) { return this.revokeFor('dataset', a, q, id, grantId); }
  @Get('dataset-tables/:id/access') @Operation('analytics.access.manage', 'dataset_table')
  listTable(@CurrentActor() a: Actor, @Query() q: OrganizationQuery, @Param('id', ParseUUIDPipe) id: string) { return this.listFor('dataset_table', a, q, id); }
  @Post('dataset-tables/:id/access') @Operation('analytics.access.manage', 'dataset_table')
  grantTable(@CurrentActor() a: Actor, @Query() q: OrganizationQuery, @Param('id', ParseUUIDPipe) id: string, @Body() b: GrantDto) { return this.grantFor('dataset_table', a, q, id, b); }
  @Delete('dataset-tables/:id/access/:grantId') @Operation('analytics.access.manage', 'dataset_table')
  revokeTable(@CurrentActor() a: Actor, @Query() q: OrganizationQuery, @Param('id', ParseUUIDPipe) id: string, @Param('grantId', ParseUUIDPipe) grantId: string) { return this.revokeFor('dataset_table', a, q, id, grantId); }
  @Get('dataset-columns/:id/access') @Operation('analytics.access.manage', 'dataset_column')
  listColumn(@CurrentActor() a: Actor, @Query() q: OrganizationQuery, @Param('id', ParseUUIDPipe) id: string) { return this.listFor('dataset_column', a, q, id); }
  @Post('dataset-columns/:id/access') @Operation('analytics.access.manage', 'dataset_column')
  grantColumn(@CurrentActor() a: Actor, @Query() q: OrganizationQuery, @Param('id', ParseUUIDPipe) id: string, @Body() b: GrantDto) { return this.grantFor('dataset_column', a, q, id, b); }
  @Delete('dataset-columns/:id/access/:grantId') @Operation('analytics.access.manage', 'dataset_column')
  revokeColumn(@CurrentActor() a: Actor, @Query() q: OrganizationQuery, @Param('id', ParseUUIDPipe) id: string, @Param('grantId', ParseUUIDPipe) grantId: string) { return this.revokeFor('dataset_column', a, q, id, grantId); }
}
