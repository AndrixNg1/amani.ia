# Prompt templates

Status: documentation placeholder; this directory has no package manifest or implementation and is not yet an initialized npm workspace.

## Purpose and technology

Hold versioned prompt templates and metadata for future AI features. Templates and optional TypeScript helpers are intended; no model SDK or prompt tooling has been selected here.

## Responsibilities and relationships

Keep prompts reviewable and free of secrets or customer data. Templates must not contain or substitute for authorization rules. The AI Orchestrator and any AI-capable Plugin API may consume templates after authorized data retrieval.

## Environment and development

No environment variables, dependencies, build configuration, or development commands are defined. If initialized later, the package name should be `@amani/prompts`. Initialize its manifest and scripts deliberately before invoking workspace commands.

## Tests

No tests or runner exist. Add checks for the package's public behavior when implementation begins; the current root checks do not validate this placeholder.

See [shared package boundaries](../README.md) and the [architecture overview](../../docs/architecture/README.md).
