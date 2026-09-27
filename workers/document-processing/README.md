# Document processing worker

Status: documentation placeholder; no worker application or package manifest exists. This directory is outside the currently configured npm workspace patterns.

## Purpose and technology

Process organization-scoped document ingestion tasks for the knowledge Plugin API, such as parsing and preparing retrieval inputs. Runtime, language, queue library, and processing tools remain undecided. Redis is prepared as local infrastructure, but no worker uses it yet.

## Responsibilities and relationships

The intended relationship is with knowledge, MinIO object storage, PostgreSQL/pgvector, and future queue infrastructure. Parsers, embedding providers, and ingestion flows are not implemented.

Jobs must carry verifiable organization and actor context. Processing, retries, output storage, and result access must preserve authorization scope and reject missing or invalid context. See the [authorization requirements](../../docs/architecture/authorization.md).

## Environment and development

There are no active environment variables, dependencies, startup commands, or deployment settings. Future configuration will need service credentials, scoped storage access, and queue connectivity; exact variable names must be documented when a runtime is implemented. Infrastructure availability alone does not start this worker.

## Tests

No test runner or tests exist. Future tests must cover scoped inputs and outputs, authorization failures, retries, and duplicate job execution using synthetic fixtures.
