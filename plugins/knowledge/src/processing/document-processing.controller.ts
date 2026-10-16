import { Body, Controller, Post } from '@nestjs/common';
import type {
  KnowledgeDocumentProcessingBatchV1,
  KnowledgeDocumentProcessingCompletionV1,
  KnowledgeDocumentProcessingFailureV1,
  KnowledgeDocumentProcessingStartV1,
} from '@amani/contracts';
import {
  CurrentActor,
  CurrentIdentity,
  Operation,
} from '../common/context';
import type { Actor, VerifiedIdentity } from '../common/context';
import { DocumentProcessingService } from './document-processing.service';

@Controller('internal/document-processing')
export class DocumentProcessingController {
  constructor(private readonly service: DocumentProcessingService) {}

  @Post('start')
  @Operation('knowledge.processing.start', 'document_version')
  start(
    @CurrentIdentity() identity: VerifiedIdentity,
    @CurrentActor() actor: Actor,
    @Body() body: KnowledgeDocumentProcessingStartV1,
  ) {
    return this.service.start(identity, actor, body);
  }

  @Post('batches')
  @Operation('knowledge.processing.publish', 'document_version')
  batch(
    @CurrentIdentity() identity: VerifiedIdentity,
    @CurrentActor() actor: Actor,
    @Body() body: KnowledgeDocumentProcessingBatchV1,
  ) {
    return this.service.publishBatch(identity, actor, body);
  }

  @Post('complete')
  @Operation('knowledge.processing.complete', 'document_version')
  complete(
    @CurrentIdentity() identity: VerifiedIdentity,
    @CurrentActor() actor: Actor,
    @Body() body: KnowledgeDocumentProcessingCompletionV1,
  ) {
    return this.service.complete(identity, actor, body);
  }

  @Post('fail')
  @Operation('knowledge.processing.fail', 'document_version')
  fail(
    @CurrentIdentity() identity: VerifiedIdentity,
    @Body() body: KnowledgeDocumentProcessingFailureV1,
  ) {
    return this.service.fail(identity, body);
  }
}
