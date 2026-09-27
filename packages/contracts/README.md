# Service contracts

Status: documentation placeholder; this directory has no package manifest or implementation and is not yet an initialized npm workspace.

## Purpose and technology

Define the public request, response, and event boundaries between Amani IA services. TypeScript contracts are intended; schema validation and generation tools remain undecided.

## Responsibilities and relationships

Describe interoperable payloads and their validation requirements. A type declaration never replaces runtime identity, membership, or permission checks. Gateway, Core API, AI Orchestrator, Plugin APIs, and the future SDK are intended consumers.

## Environment and development

No environment variables, dependencies, build configuration, or development commands are defined. If initialized later, the package name should be `@amani/contracts`. Initialize its manifest and scripts deliberately before invoking workspace commands.

## Tests

No tests or runner exist. Add checks for the package's public behavior when implementation begins; the current root checks do not validate this placeholder.

See [shared package boundaries](../README.md) and the [architecture overview](../../docs/architecture/README.md).
