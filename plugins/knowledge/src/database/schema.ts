import { integer, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Internal query mappings only. The checked-in SQL migration is authoritative for constraints.
const knowledge = pgSchema('knowledge');
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
