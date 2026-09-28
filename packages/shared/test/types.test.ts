import { createCorrelationId, createRequestId, isCorrelationId, isRequestId } from '../src/index.js';
import type { CorrelationId, RequestId } from '@amani/types';

declare function acceptsRequest(id: RequestId): void;
declare function acceptsCorrelation(id: CorrelationId): void;
declare const header: unknown;

acceptsRequest(createRequestId());
acceptsCorrelation(createCorrelationId());
if (isRequestId(header)) acceptsRequest(header);
if (isCorrelationId(header)) acceptsCorrelation(header);
// @ts-expect-error Tracing ID roles are deliberately distinct.
acceptsCorrelation(createRequestId());
// @ts-expect-error Unknown input must be validated before propagation.
acceptsRequest(header);
