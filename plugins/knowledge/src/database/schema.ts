import {
  customType,
  integer,
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// Internal query mappings only. The checked-in SQL migration is authoritative for constraints.
const knowledge = pgSchema('knowledge');
const vector = customType<{ data: readonly number[]; driverData: string }>({
  dataType: () => 'extensions.vector',
  toDriver: (value) => `[${value.join(',')}]`,
  fromDriver: (value) =>
    value.slice(1, -1).split(',').filter(Boolean).map(Number),
});
const id = () => uuid('id').primaryKey().defaultRandom();
const organizationId = () => uuid('organization_id').notNull();
const dates = () => ({
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const knowledgeBases = knowledge.table('knowledge_bases', {
  id: id(),
  organizationId: organizationId(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull(),
  createdByMembershipId: uuid('created_by_membership_id').notNull(),
  ...dates(),
});
export const knowledgeSources = knowledge.table('knowledge_sources', {
  id: id(),
  organizationId: organizationId(),
  knowledgeBaseId: uuid('knowledge_base_id').notNull(),
  sourceKind: text('source_kind').notNull(),
  provider: text('provider'),
  displayName: text('display_name').notNull(),
  externalReference: text('external_reference'),
  status: text('status').notNull(),
  createdByMembershipId: uuid('created_by_membership_id').notNull(),
  ...dates(),
});
export const documents = knowledge.table('documents', {
  id: id(),
  organizationId: organizationId(),
  knowledgeBaseId: uuid('knowledge_base_id').notNull(),
  sourceId: uuid('source_id').notNull(),
  title: text('title').notNull(),
  status: text('status').notNull(),
  accessMode: text('access_mode').notNull(),
  createdByMembershipId: uuid('created_by_membership_id').notNull(),
  ...dates(),
});
export const documentVersions = knowledge.table('document_versions', {
  id: id(),
  organizationId: organizationId(),
  documentId: uuid('document_id').notNull(),
  version: integer('version').notNull(),
  originalFilename: text('original_filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  checksumSha256: text('checksum_sha256'),
  storageBucket: text('storage_bucket').notNull(),
  storageKey: text('storage_key').notNull(),
  storageVersionId: text('storage_version_id'),
  processingStatus: text('processing_status').notNull(),
  createdByMembershipId: uuid('created_by_membership_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const documentProcessingOutbox = knowledge.table(
  'document_processing_outbox',
  {
    jobId: uuid('job_id').primaryKey(),
    organizationId: organizationId(),
    documentVersionId: uuid('document_version_id').notNull(),
    requestedByUserId: uuid('requested_by_user_id').notNull(),
    correlationId: text('correlation_id').notNull(),
    status: text('status').notNull(),
    publishAttempts: integer('publish_attempts').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...dates(),
  },
);
export const documentProcessingRuns = knowledge.table(
  'document_processing_runs',
  {
    id: id(),
    organizationId: organizationId(),
    documentVersionId: uuid('document_version_id').notNull(),
    ingestionRequestId: uuid('ingestion_request_id').notNull(),
    jobId: uuid('job_id').notNull(),
    status: text('status').notNull(),
    extractionVersion: integer('extraction_version').notNull(),
    normalizationVersion: integer('normalization_version').notNull(),
    chunkingVersion: integer('chunking_version').notNull(),
    chunkSize: integer('chunk_size').notNull(),
    chunkOverlap: integer('chunk_overlap').notNull(),
    embeddingProvider: text('embedding_provider').notNull(),
    embeddingModel: text('embedding_model').notNull(),
    embeddingDimension: integer('embedding_dimension').notNull(),
    embeddingConfigVersion: integer('embedding_config_version').notNull(),
    expectedChunkCount: integer('expected_chunk_count'),
    persistedChunkCount: integer('persisted_chunk_count').notNull(),
    failureCode: text('failure_code'),
    failureMessageSafe: text('failure_message_safe'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...dates(),
  },
);
export const documentChunks = knowledge.table('document_chunks', {
  id: id(),
  organizationId: organizationId(),
  knowledgeBaseId: uuid('knowledge_base_id').notNull(),
  sourceId: uuid('source_id').notNull(),
  documentId: uuid('document_id').notNull(),
  documentVersionId: uuid('document_version_id').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  contentChecksum: text('content_checksum').notNull(),
  sectionReference: text('section_reference'),
  pageNumber: integer('page_number'),
  embedding: vector('embedding').notNull(),
  embeddingProvider: text('embedding_provider').notNull(),
  embeddingModel: text('embedding_model').notNull(),
  embeddingDimension: integer('embedding_dimension').notNull(),
  embeddingConfigVersion: integer('embedding_config_version').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
