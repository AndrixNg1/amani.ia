import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentActor, Operation } from '../common/context';
import type { Actor } from '../common/context';
import { OrganizationQuery, PaginationQuery } from '../common/dto';
import { DocumentsService } from './documents.service';
@Controller()
export class DocumentsController {
  constructor(private readonly s: DocumentsService) {}
  @Get('knowledge-bases/:knowledgeBaseId/documents')
  @Operation('knowledge.documents.read', 'knowledge_base')
  list(
    @CurrentActor() a: Actor,
    @Query() q: PaginationQuery,
    @Param('knowledgeBaseId', ParseUUIDPipe) b: string,
  ) {
    return this.s.list(a, q.organizationId, b, q.limit ?? 50);
  }
  @Get('documents/:id') @Operation('knowledge.documents.read', 'document') get(
    @CurrentActor() a: Actor,
    @Query() q: OrganizationQuery,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.s.get(a, q.organizationId, id);
  }
  @Get('documents/:id/versions')
  @Operation('knowledge.documents.read', 'document')
  versions(
    @CurrentActor() a: Actor,
    @Query() q: OrganizationQuery,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.s.versions(a, q.organizationId, id);
  }
  @Post('documents/:id/archive')
  @Operation('knowledge.documents.manage', 'document')
  archive(
    @CurrentActor() a: Actor,
    @Query() q: OrganizationQuery,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.s.archive(a, q.organizationId, id);
  }
}
