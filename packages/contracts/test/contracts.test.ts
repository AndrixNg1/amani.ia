import type {
  ApiMetadata,
  AuthorizationContext,
  ErrorEnvelope,
  EventEnvelope,
  HealthResponse,
  JobMetadata,
  ServiceRequestContext,
} from '../src/index.js';
import type {
  CorrelationId,
  EventId,
  JobId,
  OrganizationId,
  RequestId,
  UserId,
} from '@amani/types';

declare const userId: UserId;
declare const organizationId: OrganizationId;
declare const correlationId: CorrelationId;
declare const requestId: RequestId;
declare const eventId: EventId;
declare const jobId: JobId;
declare function acceptsContext(context: ServiceRequestContext): void;
declare function acceptsAuthorization(context: AuthorizationContext): void;
declare function acceptsEvent(event: EventEnvelope): void;
declare function acceptsJob(job: JobMetadata): void;
declare function acceptsError(error: ErrorEnvelope): void;
declare function acceptsHealth(health: HealthResponse): void;

const authorization: AuthorizationContext = {
  organizationId,
  delegatedUser: { userId },
  audience: '@amani/knowledge',
  scope: { action: 'example.read', resourceType: 'example' },
  verifiedAt: '2026-09-28T08:00:00.000Z',
  expiresAt: '2026-09-28T08:01:00.000Z',
};
acceptsContext({
  requestId, correlationId, callingService: '@amani/gateway',
  timestamp: '2026-09-28T08:00:00.000Z', authorization,
});
// @ts-expect-error IDs alone do not describe a verified bounded context.
acceptsAuthorization({ organizationId, delegatedUser: { userId } });
// @ts-expect-error Authorization context is required for this delegated request contract.
acceptsContext({ requestId, correlationId, callingService: '@amani/gateway', timestamp: '' });

const event: EventEnvelope<{ readonly example: string }> = {
  eventId, eventType: 'test.example', eventVersion: 1,
  occurredAt: '2026-09-28T08:00:00.000Z', organizationId, correlationId,
  producer: '@amani/core-api', payload: { example: 'synthetic' },
};
acceptsEvent(event);
// @ts-expect-error A tenant-scoped event cannot omit its organization.
acceptsEvent({ eventId, eventType: 'test', eventVersion: 1, occurredAt: '', correlationId, producer: '@amani/core-api', payload: null });
// @ts-expect-error Event payloads must be JSON-compatible.
acceptsEvent({ ...event, payload: new Date() });

const job: JobMetadata = {
  jobId, jobType: 'test.example', jobVersion: 1, organizationId,
  requestedBy: userId, correlationId, createdAt: '2026-09-28T08:00:00.000Z',
  attempt: 1, owner: '@amani/knowledge',
};
acceptsJob(job);
// @ts-expect-error A requester is a user, never the organization itself.
acceptsJob({ ...job, requestedBy: organizationId });
// @ts-expect-error Envelope metadata cannot be mutated in place.
job.organizationId = organizationId;

const meta: ApiMetadata = { requestId, correlationId, timestamp: '2026-09-28T08:00:00.000Z' };
acceptsError({ meta, error: { code: 'EXAMPLE', message: 'Request could not be completed.' } });
// @ts-expect-error Error envelopes deliberately do not provide raw stack fields.
acceptsError({ meta, error: { code: 'EXAMPLE', message: 'Safe message', stack: 'internal' } });
acceptsHealth({ status: 'ok', service: '@amani/core-api' });
// @ts-expect-error Readiness is not process liveness.
acceptsHealth({ status: 'ready', service: '@amani/core-api' });
