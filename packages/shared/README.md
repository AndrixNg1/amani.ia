# Shared utilities

Status: documentation placeholder; this directory has no package manifest or implementation and is not yet an initialized npm workspace.

## Purpose and technology

Collect small, reusable utilities with clear ownership across projects. TypeScript is intended; build tooling and exports remain undecided.

## Responsibilities and relationships

Share domain-neutral helpers without creating hidden service dependencies or bypassing resource authorization. Keep service-specific business behavior in its owning service. Apps, Plugin APIs, and future workers may explicitly depend on utilities once a package is initialized.

## Environment and development

No environment variables, dependencies, build configuration, or development commands are defined. If initialized later, the package name should be `@amani/shared`. Initialize its manifest and scripts deliberately before invoking workspace commands.

## Tests

No tests or runner exist. Add checks for the package's public behavior when implementation begins; the current root checks do not validate this placeholder.

See [shared package boundaries](../README.md) and the [architecture overview](../../docs/architecture/README.md).
