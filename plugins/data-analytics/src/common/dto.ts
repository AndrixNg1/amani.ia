import {
  IsIn,
  IsInt,
  IsObject,
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
  @IsString() @Length(8, 128) @Matches(/^[A-Za-z0-9._:-]+$/)
  idempotencyKey!: string;
}
export class CreateConnectorSourceDto {
  @IsIn(['postgresql', 'mysql', 'sqlserver', 'warehouse', 'other'])
  provider!: 'postgresql' | 'mysql' | 'sqlserver' | 'warehouse' | 'other';
  @IsString() @Length(1, 120) @Matches(/\S/) displayName!: string;
  @IsString() @Length(1, 255) @Matches(/^\S+$/)
  connectorReference!: string;
}
export class CreateDatasetDto {
  @IsUUID() sourceId!: string;
  @IsString() @Length(1, 120) @Matches(/\S/) name!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}
export class UpdateDatasetDto {
  @IsOptional() @IsString() @Length(1, 120) @Matches(/\S/) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}
export class InitiateStructuredUploadDto extends IdempotencyDto {
  @IsIn(['csv', 'xlsx']) provider!: 'csv' | 'xlsx';
  @IsString() @Length(1, 120) @Matches(/\S/) sourceDisplayName!: string;
  @IsString() @Length(1, 120) @Matches(/\S/) datasetName!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsString() @Length(1, 255) @Matches(/\S/) filename!: string;
  @IsString() @Length(3, 150) mimeType!: string;
  @IsInt() @Min(1) @Max(1073741824) sizeBytes!: number;
}
export class GrantDto {
  @IsUUID() membershipId!: string;
  @IsIn(['read', 'analyze', 'manage']) action!: 'read' | 'analyze' | 'manage';
}
export class CreateAnalysisRequestDto extends IdempotencyDto {
  @IsUUID() datasetId!: string;
  @IsUUID() datasetVersionId!: string;
  @IsIn(['profile', 'describe', 'aggregate', 'group', 'filter', 'correlation', 'chart_data'])
  operation!:
    | 'profile'
    | 'describe'
    | 'aggregate'
    | 'group'
    | 'filter'
    | 'correlation'
    | 'chart_data';
  @IsObject() parameters!: Record<string, unknown>;
}
export class PaginationQuery extends OrganizationQuery {
  @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
}
