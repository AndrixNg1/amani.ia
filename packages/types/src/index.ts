/** Compile-time distinctions only: an identifier is never proof of access. */
declare const identifierBrand: unique symbol;
type Identifier<Name extends string> = string & {
  readonly [identifierBrand]: Name;
};

export type UserId = Identifier<'UserId'>;
export type OrganizationId = Identifier<'OrganizationId'>;
export type PluginId = Identifier<'PluginId'>;
export type ResourceId = Identifier<'ResourceId'>;
export type RequestId = Identifier<'RequestId'>;
export type CorrelationId = Identifier<'CorrelationId'>;
export type JobId = Identifier<'JobId'>;
export type EventId = Identifier<'EventId'>;

/** Stable names of the five currently declared plugin services. */
export type PluginName =
  | 'knowledge'
  | 'data-analytics'
  | 'conversations'
  | 'connectors'
  | 'evaluation';

export type ServiceName =
  | '@amani/gateway'
  | '@amani/core-api'
  | '@amani/ai-orchestrator'
  | `@amani/${PluginName}`;

/** UTC ISO 8601 text, e.g. 2026-09-28T08:00:00.000Z; validated by consumers. */
export type IsoTimestamp = string;

/** Transport data only. Finite numbers and actual JSON inputs need runtime validation. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** Metadata must be deliberately selected; this type does not redact secrets. */
export type Metadata = Readonly<Record<string, JsonValue>>;

export interface PaginationRequest {
  /** Consumers choose and enforce a positive integer bound. */
  readonly limit?: number;
  /** Opaque continuation token; not an authorization credential. */
  readonly cursor?: string;
}

export interface PaginationMetadata {
  /** Null signals the last page. Cursors must remain scoped to authorized data. */
  readonly nextCursor: string | null;
}

export interface Paginated<T> {
  readonly items: readonly T[];
  readonly pagination: PaginationMetadata;
}
