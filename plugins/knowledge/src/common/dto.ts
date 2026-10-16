import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class OrganizationQuery {
  @IsUUID() organizationId!: string;
}
export class IdempotencyDto {
  @IsString()
  @Length(8, 128)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  idempotencyKey!: string;
}
export class CreateKnowledgeBaseDto {
  @IsString() @Length(1, 120) @Matches(/\S/) name!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}
export class UpdateKnowledgeBaseDto {
  @IsOptional() @IsString() @Length(1, 120) @Matches(/\S/) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}
export class ManualSourceDto {
  @IsString() @Length(1, 120) @Matches(/\S/) displayName!: string;
}
export class GrantDto {
  @IsUUID() membershipId!: string;
  @IsIn(['read', 'ingest', 'manage']) action!: 'read' | 'ingest' | 'manage';
}
export class InitiateUploadDto extends IdempotencyDto {
  @IsUUID() sourceId!: string;
  @IsString() @Length(1, 240) @Matches(/\S/) title!: string;
  @IsString() @Length(1, 255) filename!: string;
  @IsString() @Length(3, 150) mimeType!: string;
  @IsInt() @Min(1) @Max(1073741824) sizeBytes!: number;
  @IsOptional() @IsIn(['inherit', 'restricted']) accessMode?:
    'inherit' | 'restricted';
}
export class PaginationQuery extends OrganizationQuery {
  @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
}
export class RetrievalQueryDto extends OrganizationQuery {
  @IsString() @Length(1, 2000) @Matches(/\S/) query!: string;
  @IsOptional() @IsUUID() knowledgeBaseId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(50) topK?: number;
  /** Cosine-similarity basis points; 0 means no relevance floor. */
  @IsOptional() @IsInt() @Min(0) @Max(10000) minSimilarityBps?: number;
}
