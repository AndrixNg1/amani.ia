# ADR-0037 — Structured Data Analytics foundation

**Status:** Accepted — manual validation required (2026-10-17)

## Context

Amani needs organization-scoped analysis of structured data without treating files,
connector references, metadata, query execution and authorization as one concern.
Knowledge remains the boundary for unstructured documents and RAG. The Python Data
Engine remains a later execution boundary.

## Decision

Data Analytics owns data sources, datasets, immutable dataset versions, table and
column metadata, dataset-local grants, constrained analysis-request metadata and
result metadata in its `data_analytics` schema. Every resource query includes the
verified organization and resource identifier.

CSV and XLSX uploads receive only short-lived private object-storage POST targets.
The service stores opaque object keys, validates object metadata after upload and
requires bucket versioning; it does not expose permanent URLs or parse file rows.
Connector sources keep only an opaque reference and provider classification. They do
not contain credentials and do not open a database connection.

Gateway delegates bounded user context to Data Analytics. The plugin independently
asks Core for membership, entitlement and permission policy, then applies a local
default-deny ACL. Dataset, table and column resource grants are modeled separately so
restricted columns can never enter a future analysis scope by accident.

Analysis requests accept a fixed vocabulary of operations (`profile`, `describe`,
`aggregate`, `group`, `filter`, `correlation`, `chart_data`) and validated primitive
parameters only. The plugin derives and persists a server-owned authorized scope. It
does not run SQL, Python, connectors, queues or analytics computation in this phase.

## Consequences

- Core policy is necessary but insufficient: a local resource grant is also required.
- Data Analytics never reads Knowledge tables or pgvector and Knowledge never stores
  structured datasets.
- The Data Engine may consume only a versioned, authorization-aware request contract
  in Phase 10. It must revalidate authorization and return bounded metadata.
- PostgreSQL, MinIO and Core integration require the documented migration, seed and
  manual checks before this foundation is considered operational.

## Security

Missing context, Core denial, missing local grant, cross-organization ID, invalid
scope, invalid object metadata and unsupported input are denied. Presigned upload
fields are tightly bound to the expected object key, content type and size. Logs and
responses omit secret values, storage credentials, permanent object URLs and data rows.

## Related decisions

- ADR-0008 PostgreSQL and pgvector
- ADR-0009 data ownership and migrations
- ADR-0010 multi-tenant isolation
- ADR-0012 roles, permissions and resources
- ADR-0014 object storage
- ADR-0020 Data Analytics plugin
- ADR-0024 background workers and Python Data Engine
