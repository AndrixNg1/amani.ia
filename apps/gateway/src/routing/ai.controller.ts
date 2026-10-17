import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { RequirePluginUse } from '../auth/guards';
import { CurrentContext } from '../common/context';
import type { RequestContext } from '../common/context';
import { OrchestratorClient } from '../orchestrator-client/orchestrator.client';

class AskKnowledgeRagDto {
  @IsString()
  @Length(1, 2000)
  @Matches(/\S/)
  question!: string;

  @IsOptional()
  @IsUUID()
  knowledgeBaseId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  minSimilarityBps?: number;
}

@Controller('api/ai/organizations/:organizationId')
export class AiController {
  constructor(private readonly orchestrator: OrchestratorClient) {}

  @Post('knowledge-rag')
  @RequirePluginUse('knowledge')
  ask(
    @CurrentContext() context: RequestContext,
    @Param('organizationId') _organizationId: string,
    @Body() body: AskKnowledgeRagDto,
  ) {
    void _organizationId;
    return this.orchestrator.ask(context, body);
  }
}
