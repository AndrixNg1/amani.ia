# @amani/contracts

Status: Phase 1 transport types implemented. No runtime schemas, authentication,
authorization engine, OpenAPI generation, SDK or network client is implemented.

## Responsibilities and boundaries

- `ServiceRequestContext`: request/correlation IDs, calling service, timestamp
  and a bounded `AuthorizationContext`.
- `AuthorizationContext`: organization, delegated user, audience, operation/resource
  scope, verification time and expiration time.
- `DelegatedUserContext`, `AuthorizationScope`: descriptive identity/scope metadata.
- `ApiMetadata`, `ApiError`, `ErrorEnvelope`: common API/error shape.
- `HealthResponse`: `{ status: 'ok', service }`, process liveness only.
- `EventEnvelope<Payload>`, `JobMetadata`: tenant-scoped, versioned async provenance.

No ORM entities, service-internal DTOs, repositories, business events, credentials,
roles, permission engine or broker dependencies belong here.

## Trust boundary

The request context describes **already verified context** inside a service.
Its TypeScript shape or a successful JSON parse does not authenticate it. Future
receivers must verify the calling service, delegation integrity, audience, expiry,
current organization membership and operation/resource permissions. User/organization
headers alone never establish trust. No verification helper or token format is supplied.

Organization identity appears once in `authorization.organizationId`, and user
identity once in `authorization.delegatedUser.userId`. An absent `scope.resourceId`
denotes a collection operation, never unrestricted access: recipient-side filtering
remains mandatory. No default tenant or privileged fallback exists.

Events/jobs are provenance, not permanent authorization snapshots. Workers must
reauthorize before sensitive reads and before result publication. `requestedBy` is
a user ID; service-only jobs require later design. Event/job versions must be positive
integers, `attempt` starts at 1, timestamps use UTC ISO 8601, and retries retain
`jobId`. These invariants require future runtime validators.

Error messages must be sanitized by the owning API. No raw stack, cause, token or
private-resource detail field is defined. Structural typing is not runtime redaction.
Health responses establish no database readiness, connectivity or security property.

## Usage

```ts
import type { EventEnvelope, ServiceRequestContext } from '@amani/contracts';

// Synthetic example, not a new business event.
type ExampleEvent = EventEnvelope<{ readonly reference: string }>;

function describeVerifiedRequest(context: ServiceRequestContext) {
  return {
    requestId: context.requestId,
    organizationId: context.authorization.organizationId,
    userId: context.authorization.delegatedUser.userId,
  };
}
```

## Dependencies and validation

Only `@amani/types`, using type imports; the dependency is needed by emitted
TypeScript declarations. Development dependencies are TypeScript and ESLint.

```bash
npm run build --workspace=@amani/contracts
npm run typecheck --workspace=@amani/contracts
npm run lint:check --workspace=@amani/contracts
npm run test:types --workspace=@amani/contracts
```

`tsc -b` builds the `types` reference first. Source mappings allow compilation before
npm creates workspace links; emitted declarations retain public `@amani/types`
imports. Compiler fixtures cover contexts, required tenant fields, JSON payloads,
job actors, errors and liveness. No fake runtime `test` script is supplied.

## Future integration and ADR status

Gateway, Core, Orchestrator and plugins will adopt contracts later; none consumes
them now. Runtime schemas, compatibility checks, OpenAPI and SDK generation remain
open under proposed ADR-0005/0006/0007/0011. The requested `eventId` is used instead
of ADR-0007's proposed `messageId`, without a second duplicate ID.

See [package setup](../README.md),
[ADR-0007](../../docs/architecture/adr/0007-api-contracts-versioning.md) and
[authorization requirements](../../docs/architecture/authorization.md).
