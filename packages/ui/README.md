# Shared UI

Status: documentation placeholder; this directory has no package manifest or implementation and is not yet an initialized npm workspace.

## Purpose and technology

Provide reusable presentation components for the three frontends. React and TypeScript are intended to match the existing Next.js frontends; packaging and styling integration remain undecided.

## Responsibilities and relationships

Keep components accessible and reusable. Hiding a control does not enforce authorization; backend permission checks remain mandatory. Website, enterprise, and admin are intended consumers. No frontend currently imports components from this directory.

## Environment and development

No environment variables, dependencies, build configuration, or development commands are defined. If initialized later, the package name should be `@amani/ui`. Initialize its manifest and scripts deliberately before invoking workspace commands.

## Tests

No tests or runner exist. Add checks for the package's public behavior when implementation begins; the current root checks do not validate this placeholder.

See [shared package boundaries](../README.md) and the [architecture overview](../../docs/architecture/README.md).
