# @amani/shared

Tracing ID helpers and tests, used by Gateway and Core. The package intentionally
stays small.

## Responsibilities and usage

`createRequestId()` and `createCorrelationId()` generate UUID v4 values using
`node:crypto.randomUUID()`. No UUID library or weak random fallback is introduced.

`isRequestId(value)` and `isCorrelationId(value)` accept 1–128 ASCII characters,
starting with an alphanumeric character and continuing with alphanumerics, `.`,
`_`, `-`. Safe non-UUID tracing IDs may be propagated. Arrays, spaces, control
characters, Unicode and oversized inputs fail. `MAX_TRACE_ID_LENGTH` is 128.
`resolveCorrelationId(value)` preserves valid input or replaces it with a UUID,
without echoing rejected input.

```ts
import { createRequestId, resolveCorrelationId } from '@amani/shared';

function tracingForRequest(untrustedCorrelationHeader: unknown) {
  return {
    requestId: createRequestId(),
    correlationId: resolveCorrelationId(untrustedCorrelationHeader),
  };
}
```

Generate a request ID per request; propagate a correlation ID through the request
chain. Header extraction and framework integration belong to the service.

These are **format checks, not authentication or authorization**. Tracing IDs must
not act as credentials, access grants or idempotency guarantees. A valid ID can
still be externally chosen. Callers decide whether their trust boundary preserves
it or generates a new one; never put secrets/customer content in IDs.

## Dependencies and non-responsibilities

Only `@amani/types`, imported for branded ID types, plus Node crypto at runtime.
Development dependencies explicitly declare TypeScript, ESLint, Jest and Node types.

No authorization logic, roles, repositories, ORM, plugin logic, Nest modules,
frontend components, AI orchestration, event bus or broad utility collection.
Common error helpers can be added when real consumers justify them; no speculative
error hierarchy is introduced.

## Validation

```bash
npm run build --workspace=@amani/shared
npm run typecheck --workspace=@amani/shared
npm run lint:check --workspace=@amani/shared
npm run test --workspace=@amani/shared -- --runInBand
```

The build references `types` and builds it first. Source mappings support checks
before installation creates npm links. Tests build first, exercise emitted code,
check hostile/oversized IDs, propagation, UUID generation and CommonJS/ESM exports.
Compiler fixtures verify narrowing and request/correlation ID distinctions.

The boundary suite inspects all four shared-package manifests and source imports, rejects
undeclared/cross-service dependencies, checks graph cycles and keeps SDK/prompts/UI
uninitialized. These are static development checks, not service security tests.

## Future integration

Gateway and Core use these helpers. Other APIs, plugins and Node workers may adopt
them as needed; framework integration stays inside the consuming service.
See [package setup](../README.md),
[ADR-0005](../../docs/architecture/adr/0005-backend-sync-communication.md) and
[ADR-0028](../../docs/architecture/adr/0028-observability-resilience-secrets.md).
