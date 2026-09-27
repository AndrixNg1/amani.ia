# Shared types

Status: documentation placeholder; this directory has no package manifest or implementation and is not yet an initialized npm workspace.

## Purpose and technology

Provide reusable compile-time domain types for TypeScript projects. TypeScript declarations are intended; exports and packaging remain undecided.

## Responsibilities and relationships

Keep shared types aligned with the contracts package. Type checking does not validate untrusted input or enforce organization permissions at runtime. Apps, Plugin APIs, the future SDK, and future workers may consume these types.

## Environment and development

No environment variables, dependencies, build configuration, or development commands are defined. If initialized later, the package name should be `@amani/types`. Initialize its manifest and scripts deliberately before invoking workspace commands.

## Tests

No tests or runner exist. Add checks for the package's public behavior when implementation begins; the current root checks do not validate this placeholder.

See [shared package boundaries](../README.md) and the [architecture overview](../../docs/architecture/README.md).
