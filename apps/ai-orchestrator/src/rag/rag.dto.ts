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
import type { KnowledgeRagRequestV1 } from '@amani/contracts';

export class KnowledgeRagRequestDto implements KnowledgeRagRequestV1 {
  @IsUUID()
  organizationId!: string;

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
