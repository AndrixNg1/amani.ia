import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentActor, Operation } from '../common/context';
import type { Actor } from '../common/context';
import { InitiateUploadDto, OrganizationQuery } from '../common/dto';
import { UploadsService } from './uploads.service';
@Controller()
export class UploadsController {
  constructor(private readonly service: UploadsService) {}
  @Post('knowledge-bases/:knowledgeBaseId/uploads')
  @Operation('knowledge.uploads.ingest', 'knowledge_base')
  initiate(
    @CurrentActor() a: Actor,
    @Query() q: OrganizationQuery,
    @Param('knowledgeBaseId', ParseUUIDPipe) b: string,
    @Body() dto: InitiateUploadDto,
  ) {
    return this.service.initiate(a, q.organizationId, b, dto);
  }
  @Post('uploads/:id/finalize')
  @Operation('knowledge.uploads.ingest', 'document_version')
  finalize(
    @CurrentActor() a: Actor,
    @Query() q: OrganizationQuery,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.finalize(a, q.organizationId, id);
  }
}
