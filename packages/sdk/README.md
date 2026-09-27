# Service SDK

Status: documentation placeholder; this directory has no package manifest or implementation and is not yet an initialized npm workspace.

## Purpose and technology

Provide typed clients for supported Amani IA service interfaces. TypeScript is intended; transport, generated-client tooling, and distribution remain undecided.

## Responsibilities and relationships

Represent supported APIs, errors, and caller configuration. Clients must preserve verified authorization context where appropriate; servers remain responsible for access decisions. Application consumers may use this package alongside service contracts. No frontend or backend currently imports an SDK from this directory.

## Environment and development

No environment variables, dependencies, build configuration, or development commands are defined. If initialized later, the package name should be `@amani/sdk`. Initialize its manifest and scripts deliberately before invoking workspace commands.

## Tests

No tests or runner exist. Add checks for the package's public behavior when implementation begins; the current root checks do not validate this placeholder.

See [shared package boundaries](../README.md) and the [architecture overview](../../docs/architecture/README.md).
