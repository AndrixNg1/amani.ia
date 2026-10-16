# Workers

This directory contains the TypeScript [document-processing](document-processing/README.md)
worker and reserves the Python [data-engine](data-engine/README.md).

`@amani/document-processing` is an npm workspace. It consumes only the versioned
Knowledge ingestion contract through Redis/BullMQ, revalidates through Knowledge and
returns bounded results to Knowledge. It has no direct PostgreSQL or MinIO access.
The Data Engine remains a placeholder and is not expected to consume BullMQ internals.

Workers remain backend-owned and organization-scoped. Jobs and storage access preserve
and revalidate organization/user scope as described in the
[authorization requirements](../docs/architecture/authorization.md).
