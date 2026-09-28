# @amani/types

Status: initialized in Phase 1. Framework-independent compile-time primitives;
no runtime validation, database model or service integration.

## Responsibilities and boundaries

- Branded string IDs: `UserId`, `OrganizationId`, `PluginId`, `ResourceId`,
  `RequestId`, `CorrelationId`, `JobId`, `EventId`.
- `PluginName` and `ServiceName`: the five declared plugin names and eight backend
  package names. These are naming conventions, not an authenticated registry.
- `PaginationRequest`, `PaginationMetadata`, `Paginated<T>`: cursor pagination.
- `IsoTimestamp`, `JsonValue`, `Metadata`: portable transport metadata.

No ORM entities, database schemas, repositories, Nest modules, frontend components,
plugin models or business logic belong here. IDs are opaque references, not access
rights. UTC ISO 8601 timestamps, finite JSON numbers, positive pagination limits
and tenant-scoped cursors still need runtime validation by consumers.

## Usage

```ts
import type { OrganizationId, Paginated, UserId } from '@amani/types';

type MemberReferencePage = Paginated<{ readonly id: UserId }>;
type OrganizationReference = { readonly organizationId: OrganizationId };
```

Brands prevent accidental ID mixups at compile time. They do not authenticate or
validate input. Future trusted adapters must validate IDs before constructing them;
casting raw request headers is not authentication. No database ID format is imposed.
Tracing ID creation and format checks live in `@amani/shared`.

## Dependencies and validation

No runtime or internal package dependencies. Development dependencies are explicit
TypeScript and ESLint tools already used in the repository. Source compilation
has no framework or Node ambient types.

```bash
npm run build --workspace=@amani/types
npm run typecheck --workspace=@amani/types
npm run lint:check --workspace=@amani/types
npm run test:types --workspace=@amani/types
```

The build emits CommonJS and declarations to `dist/`; consumers use `import type`.
`test:types` and `typecheck` compile positive/negative fixtures for ID distinctions,
JSON transport data and readonly pages without emitting application code. There is
intentionally no runtime `test` script for this types-only package.

## Future integration

Contracts and shared helpers depend on these types. Applications, plugins, the
future SDK and TypeScript workers may add explicit dependencies later; none has
been changed to consume them. Python needs future language-neutral schemas, not
TypeScript declarations alone.

See [package setup](../README.md) and
[ADR-0001](../../docs/architecture/adr/0001-npm-monorepo.md).
