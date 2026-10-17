# Data Analytics Plugin API

`@amani/data-analytics` is Amani IA's boundary for structured enterprise data. The
current foundation owns source references, datasets, immutable upload versions, schema
metadata, local resource grants, constrained analysis requests and result metadata.

It does not parse CSV/XLSX rows, connect to customer databases, run SQL, execute
Python, invoke an LLM or run a queue worker. Those responsibilities remain outside this
phase; the Python Data Engine is the planned execution boundary.

## Architecture and security

Gateway sends a signed, short-lived delegated user and organization context. This
service rechecks Core membership, entitlement and permission policy, then requires its
own default-deny dataset ACL. Core policy alone never grants access to a dataset.

All owned PostgreSQL records are scoped by `organization_id` and resource ID. The
plugin owns the `data_analytics` schema and does not use cross-schema foreign keys.
Dataset, table and column grants are distinct. Restricted columns are excluded from the
server-derived scope stored with an analysis request.

Manual uploads receive a short-lived S3-compatible POST target for one opaque object
key, exact media type and exact content length. The bucket must be private and
versioned. Finalization verifies object metadata and records a pinned version/checksum;
no permanent object URL is returned. Connector sources hold an opaque reference only,
never connection credentials or a live connection.

See [ADR-0037](../../docs/architecture/adr/0037-structured-data-analytics.md) and the
[editable architecture diagram](../../docs/architecture/diagrams/23-structured-data-analytics.mmd).

## API surface

Gateway exposes the public prefix `/api/analytics/organizations/:organizationId` for:

- connector-source registration and archival;
- datasets, versions and schema metadata;
- private CSV/XLSX upload initiation and finalization;
- dataset/table/column grant administration;
- constrained analysis-request creation and result metadata retrieval.

The analysis vocabulary is `profile`, `describe`, `aggregate`, `group`, `filter`,
`correlation` and `chart_data`. Parameters are validated against the operation; raw SQL,
arbitrary code and unrestricted query fields are rejected.

## Configuration

Copy the example before starting the service:

```bash
cp plugins/data-analytics/.env.example plugins/data-analytics/.env
```

Set the plugin database password, `CORE_API_URL`, a distinct local Gateway delegation
secret, a distinct Data-to-Core secret and the private MinIO/S3 credentials. The
Gateway's `DEVELOPMENT_SERVICE_SECRET` must match
`DATA_ANALYTICS_DEVELOPMENT_SERVICE_SECRET`; Core's
`DATA_ANALYTICS_CORE_DEVELOPMENT_SECRET` must match the Data-to-Core secret. Development
authentication is restricted to loopback `development`/`test` configurations.

## Manual validation commands

Run these from the repository root after reviewing local `.env` files. The dependency
manifest changed, so the root install is required before any command that resolves the
new AWS/Drizzle dependencies.

```bash
npm install
npm run infra:up -- --no-build --pull never
npm run db:migrate --workspace=@amani/core-api
npm run db:seed --workspace=@amani/core-api
npm run db:migrate --workspace=@amani/data-analytics
npm run build --workspace=@amani/config
npm run build --workspace=@amani/types
npm run build --workspace=@amani/contracts
npm run build --workspace=@amani/shared
npm run lint:check --workspace=@amani/data-analytics
npm run typecheck --workspace=@amani/data-analytics
npm run build --workspace=@amani/data-analytics
npm run test --workspace=@amani/data-analytics -- --runInBand
npm run test:e2e --workspace=@amani/data-analytics -- --runInBand
```

Start Core, Data Analytics and Gateway in separate terminals with their existing
`npm run dev:*` root commands. Check `/health` and `/health/ready` on Data Analytics.
Then create an organization, ensure Core grants `analytics.datasets.read` and
`analytics.datasets.analyze` to a suitable role, create/upload a dataset through the
Gateway, and verify: one tenant cannot retrieve another tenant's dataset, a user without
a local dataset grant receives a denial, restricted columns are absent from analysis
scope, and a malformed/oversized/wrong-type upload is rejected.

## Phase boundary

This service stores only intent and metadata for analytics execution. It must not be
treated as a data engine yet. Phase 10 will define the authenticated job contract,
revalidation, bounded execution, artifact handling, cancellation and audit behavior
between this API and the Python Data Engine.
