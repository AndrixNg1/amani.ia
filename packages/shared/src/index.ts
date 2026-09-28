import { randomUUID } from 'node:crypto';
import type { CorrelationId, RequestId } from '@amani/types';

/** Bound untrusted tracing headers before propagation or logging. */
export const MAX_TRACE_ID_LENGTH = 128;

function isTraceId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= MAX_TRACE_ID_LENGTH
    && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}

/** Shape validation only; never proof of identity or authorization. */
export function isRequestId(value: unknown): value is RequestId {
  return isTraceId(value);
}

/** Shape validation only; never proof of identity or authorization. */
export function isCorrelationId(value: unknown): value is CorrelationId {
  return isTraceId(value);
}

/** Generate a new ID for each request using the runtime's cryptographic UUID source. */
export function createRequestId(): RequestId {
  return randomUUID() as RequestId;
}

/** Generate a correlation ID at the entry point of a request chain. */
export function createCorrelationId(): CorrelationId {
  return randomUUID() as CorrelationId;
}

/** Preserve a valid tracing ID, otherwise replace it; never echo rejected input. */
export function resolveCorrelationId(value: unknown): CorrelationId {
  return isCorrelationId(value) ? value : createCorrelationId();
}
