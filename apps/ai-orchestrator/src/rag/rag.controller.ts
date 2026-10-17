import { Body, Controller, Post } from '@nestjs/common';
import type { Actor } from '../common/context';
import { CurrentActor, Operation } from '../common/context';
import { KnowledgeRagRequestDto } from './rag.dto';
import { KnowledgeRagService } from './rag.service';

@Controller('ai')
export class KnowledgeRagController {
  constructor(private readonly rag: KnowledgeRagService) {}

  @Post('knowledge-rag')
  @Operation('ai.knowledge-rag.ask', 'knowledge')
  ask(@CurrentActor() actor: Actor, @Body() body: KnowledgeRagRequestDto) {
    return this.rag.answer(actor, body);
  }
}
