import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentActor, Operation } from '../common/context';
import type { Actor } from '../common/context';
import {
  CreateKnowledgeBaseDto,
  OrganizationQuery,
  UpdateKnowledgeBaseDto,
} from '../common/dto';
import { KnowledgeBasesService } from './knowledge-bases.service';
@Controller('knowledge-bases')
export class KnowledgeBasesController {
  constructor(private readonly service: KnowledgeBasesService) {}
  @Post() @Operation('knowledge.bases.manage', 'knowledge_base') create(
    @CurrentActor() actor: Actor,
    @Query() q: OrganizationQuery,
    @Body() b: CreateKnowledgeBaseDto,
  ) {
    return this.service.create(actor, q.organizationId, b);
  }
  @Get() @Operation('knowledge.bases.read', 'knowledge_base') list(
    @CurrentActor() actor: Actor,
    @Query() q: OrganizationQuery,
  ) {
    return this.service.list(actor, q.organizationId);
  }
  @Get(':id') @Operation('knowledge.bases.read', 'knowledge_base') get(
    @CurrentActor() actor: Actor,
    @Query() q: OrganizationQuery,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.get(actor, q.organizationId, id);
  }
  @Patch(':id') @Operation('knowledge.bases.manage', 'knowledge_base') update(
    @CurrentActor() actor: Actor,
    @Query() q: OrganizationQuery,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: UpdateKnowledgeBaseDto,
  ) {
    return this.service.update(actor, q.organizationId, id, b);
  }
  @Post(':id/archive')
  @Operation('knowledge.bases.manage', 'knowledge_base')
  archive(
    @CurrentActor() actor: Actor,
    @Query() q: OrganizationQuery,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.archive(actor, q.organizationId, id);
  }
}
