import type {
  CorrelationId,
  EventId,
  IsoTimestamp,
  JobId,
  JsonValue,
  OrganizationId,
  PluginName,
  RequestId,
  ResourceId,
  ServiceName,
  UserId,
} from '@amani/types';

/** Established by an authentication provider, never by identity headers. */
export interface AuthenticatedPrincipal {
  readonly userId: UserId;
  readonly authenticationMethod: string;
  readonly issuedAt: IsoTimestamp;
  readonly subject?: string;
}

/** Local integration protocol only; not a production authentication decision. */
export interface DevelopmentDelegation {
  readonly version: 1;
  readonly requestId: RequestId;
  readonly correlationId: CorrelationId;
  readonly callingService: '@amani/gateway';
  readonly audience: '@amani/core-api';
  readonly userId: UserId;
  readonly organizationId?: OrganizationId;
  readonly scope: AuthorizationScope;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly nonce: string;
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly bodySha256: string;
}

/** Wire projections owned by Core; no ORM models or policy implementation. */
export interface CoreAuthorizationDecision {
  readonly allowed: boolean;
  readonly organizationId: string;
  readonly userId: string;
  readonly permission: string;
  readonly reason: 'ROLE_PERMISSION' | 'INACTIVE_CONTEXT' | 'MISSING_PERMISSION'
    | 'PLUGIN_UNAVAILABLE' | 'WRONG_ORGANIZATION';
}
export interface CoreEffectivePermissions {
  readonly organizationId: string;
  readonly userId: string;
  readonly permissions: readonly string[];
}
export interface CoreOrganization {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: 'draft' | 'provisioning' | 'active' | 'failed' | 'suspended';
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}
export interface CoreUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly status: 'active' | 'suspended';
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}
export interface CoreMembership {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly status: 'active' | 'inactive';
  readonly joinedAt: IsoTimestamp;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

/** Identity already verified by the future authentication boundary, never raw headers. */
export interface DelegatedUserContext {
  readonly userId: UserId;
}

/** Descriptive scope, not a policy decision or a grant of access. */
export interface AuthorizationScope {
  readonly action: string;
  readonly resourceType: string;
  /** Absence targets a collection operation, never unrestricted resource access. */
  readonly resourceId?: ResourceId;
  readonly plugin?: PluginName;
  readonly policyVersion?: string;
}

/**
 * In-memory representation of previously verified, bounded context.
 * TypeScript cannot authenticate it. Recipients must verify service identity,
 * delegation integrity, audience, expiry, membership and current resource access.
 * No token format or authentication implementation is defined here.
 */
export interface AuthorizationContext {
  readonly organizationId: OrganizationId;
  readonly delegatedUser: DelegatedUserContext;
  readonly audience: ServiceName;
  readonly scope: AuthorizationScope;
  readonly verifiedAt: IsoTimestamp;
  readonly expiresAt: IsoTimestamp;
}

export interface ServiceRequestContext {
  readonly requestId: RequestId;
  readonly correlationId: CorrelationId;
  /** Identity established by service authentication, not a caller-selected name. */
  readonly callingService: ServiceName;
  readonly timestamp: IsoTimestamp;
  readonly authorization: AuthorizationContext;
}

export interface ApiMetadata {
  readonly requestId: RequestId;
  readonly correlationId: CorrelationId;
  readonly timestamp: IsoTimestamp;
  readonly apiVersion?: string;
}

export interface ApiError {
  /** Stable machine-readable code defined by the owning API. */
  readonly code: string;
  /** Public, deliberately sanitized message; never a raw exception or secret. */
  readonly message: string;
}

export interface ErrorEnvelope {
  readonly error: ApiError;
  readonly meta: ApiMetadata;
}

/** Matches the existing process-liveness route. No readiness or security claim. */
export interface HealthResponse {
  readonly status: 'ok';
  readonly service: ServiceName;
}

/** Tenant-scoped transport envelope, not a trusted authorization snapshot. */
export interface EventEnvelope<Payload extends JsonValue = JsonValue> {
  readonly eventId: EventId;
  readonly eventType: string;
  /** Positive integer schema version, validated by the eventual transport boundary. */
  readonly eventVersion: number;
  readonly occurredAt: IsoTimestamp;
  readonly organizationId: OrganizationId;
  readonly correlationId: CorrelationId;
  readonly producer: ServiceName;
  readonly payload: Payload;
}

/** Job provenance only. Reauthorize at execution and before publishing results. */
export interface JobMetadata {
  readonly jobId: JobId;
  readonly jobType: string;
  /** Positive integer schema version. */
  readonly jobVersion: number;
  readonly organizationId: OrganizationId;
  readonly requestedBy: UserId;
  readonly correlationId: CorrelationId;
  readonly createdAt: IsoTimestamp;
  /** One-based execution attempt; retries retain the same jobId. */
  readonly attempt: number;
  readonly owner: ServiceName;
  readonly resourceId?: ResourceId;
  readonly action?: string;
  readonly resourceVersion?: string;
  readonly idempotencyKey?: string;
  readonly expiresAt?: IsoTimestamp;
}
