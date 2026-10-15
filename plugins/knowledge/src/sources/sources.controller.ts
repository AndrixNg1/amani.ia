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
import { ManualSourceDto, OrganizationQuery } from '../common/dto';
import { SourcesService } from './sources.service';
@Controller('knowledge-bases/:knowledgeBaseId/sources')
export class SourcesController {
  constructor(private readonly service: SourcesService) {}
  @Post('manual')
  @Operation('knowledge.sources.ingest', 'knowledge_base')
  create(
    @CurrentActor() a: Actor,
    @Query() q: OrganizationQuery,
    @Param('knowledgeBaseId', ParseUUIDPipe) b: string,
    @Body() dto: ManualSourceDto,
  ) {
    return this.service.createManual(a, q.organizationId, b, dto);
  }
  @Get() @Operation('knowledge.sources.read', 'knowledge_base') list(
    @CurrentActor() a: Actor,
    @Query() q: OrganizationQuery,
    @Param('knowledgeBaseId', ParseUUIDPipe) b: string,
  ) {
    return this.service.list(a, q.organizationId, b);
  }
  @Get(':id') @Operation('knowledge.sources.read', 'knowledge_base') get(
    @CurrentActor() a: Actor,
    @Query() q: OrganizationQuery,
    @Param('knowledgeBaseId', ParseUUIDPipe) b: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.get(a, q.organizationId, b, id);
  }
}
