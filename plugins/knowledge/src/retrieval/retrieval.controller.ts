import { Body, Controller, Post } from '@nestjs/common';
import { CurrentActor, Operation } from '../common/context';
import type { Actor } from '../common/context';
import { RetrievalQueryDto } from '../common/dto';
import { RetrievalService } from './retrieval.service';

@Controller('knowledge')
export class RetrievalController {
  constructor(private readonly retrieval: RetrievalService) {}

  @Post('retrieval')
  @Operation('knowledge.documents.read', 'knowledge_base')
  search(@CurrentActor() actor: Actor, @Body() body: RetrievalQueryDto) {
    return this.retrieval.retrieve(actor, body);
  }
}
