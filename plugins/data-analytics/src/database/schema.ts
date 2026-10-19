import {
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { Metadata } from '@amani/types';

// Internal mappings only. The checked-in SQL migration owns constraints and lifecycle checks.
const analytics = pgSchema('data_analytics');
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
export const dataSources = analytics.table('data_sources', {
  id: id(),
  organizationId: organizationId(),
  sourceKind: text('source_kind').notNull(),
  provider: text('provider').notNull(),
  displayName: text('display_name').notNull(),
  connectorReference: text('connector_reference'),
  status: text('status').notNull(),
  createdByMembershipId: uuid('created_by_membership_id').notNull(),
  ...dates(),
});
export const datasets = analytics.table('datasets', {
  id: id(),
  organizationId: organizationId(),
  sourceId: uuid('source_id').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull(),
  createdByMembershipId: uuid('created_by_membership_id').notNull(),
  ...dates(),
});
export const datasetVersions = analytics.table('dataset_versions', {
  id: id(),
  organizationId: organizationId(),
  datasetId: uuid('dataset_id').notNull(),
  version: integer('version').notNull(),
  originalFilename: text('original_filename'),
  mimeType: text('mime_type'),
  sizeBytes: integer('size_bytes'),
  checksumSha256: text('checksum_sha256'),
  storageBucket: text('storage_bucket'),
  storageKey: text('storage_key'),
  storageVersionId: text('storage_version_id'),
  importStatus: text('import_status').notNull(),
  createdByMembershipId: uuid('created_by_membership_id').notNull(),
  ...dates(),
});
export const datasetTables = analytics.table('dataset_tables', {
  id: id(),
  organizationId: organizationId(),
  datasetId: uuid('dataset_id').notNull(),
  datasetVersionId: uuid('dataset_version_id').notNull(),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  ordinal: integer('ordinal').notNull(),
  rowCount: integer('row_count'),
  metadataStatus: text('metadata_status').notNull(),
  ...dates(),
});
export const datasetColumns = analytics.table('dataset_columns', {
  id: id(),
  organizationId: organizationId(),
  tableId: uuid('table_id').notNull(),
  name: text('name').notNull(),
  ordinal: integer('ordinal').notNull(),
  logicalType: text('logical_type').notNull(),
  nullable: text('nullable').notNull(),
  securityClassification: text('security_classification').notNull(),
  visibility: text('visibility').notNull(),
  ...dates(),
});
export const resourceGrants = analytics.table('resource_grants', {
  id: id(),
  organizationId: organizationId(),
  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id').notNull(),
  subjectType: text('subject_type').notNull(),
  subjectId: uuid('subject_id').notNull(),
  action: text('action').notNull(),
  createdByMembershipId: uuid('created_by_membership_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const analysisRequests = analytics.table('analysis_requests', {
  id: id(),
  organizationId: organizationId(),
  datasetId: uuid('dataset_id').notNull(),
  datasetVersionId: uuid('dataset_version_id').notNull(),
  requestedByMembershipId: uuid('requested_by_membership_id').notNull(),
  operation: text('operation').notNull(),
  parameters: jsonb('parameters').$type<Metadata>().notNull(),
  scope: jsonb('scope').$type<Metadata>().notNull(),
  status: text('status').notNull(),
  correlationId: text('correlation_id').notNull(),
  ...dates(),
});
