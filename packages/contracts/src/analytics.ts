import type { CoreAuthorizationDecision, JobMetadata } from "./index";

/** Opaque structured-source provenance. It deliberately contains no credentials. */
export interface StructuredDataSourceReference {
  readonly sourceKind: "manual_upload" | "connector";
  readonly provider:
    | "csv"
    | "xlsx"
    | "postgresql"
    | "mysql"
    | "sqlserver"
    | "warehouse"
    | "other";
  /** Connectors-owned opaque reference; never a connection string or secret. */
  readonly connectorReference?: string;
}

export interface DataAnalysisAuthorizationRequest {
  readonly organizationId: string;
  readonly permission:
    | "analytics.datasets.read"
    | "analytics.datasets.analyze"
    | "plugins.use"
    | "plugins.manage";
  /** Only a plugins.manage caller may resolve a membership recipient. */
  readonly subjectMembershipId?: string;
}

export interface DataAnalysisAuthorizationResponse {
  readonly decision: CoreAuthorizationDecision;
  readonly membershipId: string;
  readonly subjectMembershipId?: string;
}

export type AnalysisOperation =
  | "profile"
  | "describe"
  | "aggregate"
  | "group"
  | "filter"
  | "correlation"
  | "chart_data";

/** Server-derived effective scope. Callers and future models never author this. */
export interface DatasetColumnScope {
  readonly tableId: string;
  readonly columnId: string;
  readonly access: "allowed" | "blocked";
}

export interface AnalysisScope {
  readonly datasetId: string;
  readonly allowedTableIds: readonly string[];
  readonly columns: readonly DatasetColumnScope[];
  readonly operation: AnalysisOperation;
}

/**
 * Versioned, transport-neutral work intent for the future Python Data Engine.
 * It is not a BullMQ payload and excludes credentials, data rows and authorization grants.
 */
export interface DataAnalysisRequestedV1 {
  readonly type: "data-analytics.analysis.requested";
  readonly version: 1;
  readonly job: JobMetadata;
  readonly organizationId: string;
  readonly datasetId: string;
  readonly datasetVersionId: string;
  readonly analysisRequestId: string;
  readonly operation: AnalysisOperation;
  readonly parameters: Readonly<Record<string, string | number | boolean>>;
  readonly scope: AnalysisScope;
}

/** Metadata only. Large structured results and artifacts are not stored inline. */
export interface DataAnalysisResultMetadataV1 {
  readonly type: "data-analytics.analysis.result";
  readonly version: 1;
  readonly id: string;
  readonly organizationId: string;
  readonly analysisRequestId: string;
  readonly status: "pending" | "ready" | "failed" | "expired";
  readonly resultType: "metadata" | "table" | "chart_data" | "artifact";
  readonly artifactReference: string | null;
  readonly expiresAt: string | null;
}
