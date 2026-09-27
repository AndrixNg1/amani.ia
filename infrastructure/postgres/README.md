# PostgreSQL and pgvector

PostgreSQL is the planned relational store for organization-owned application data. pgvector supplies vector types and similarity search for future authorized knowledge retrieval. The local container uses `pgvector/pgvector:0.8.6-pg17-bookworm`; no application schema, migration framework, dedicated service roles or row-level security policies are implemented.

## Configuration

The root Compose service is `postgres`, published on `127.0.0.1:5432`, with a persistent `postgres_data` volume. The root `.env` supplies `POSTGRES_DB=amani`, `POSTGRES_USER=amani`, required `POSTGRES_PASSWORD` and optional `POSTGRES_PORT`. The initial user created by the image is an administrative bootstrap user, not a future production application role. Host applications will need separate connection configuration using the same database and credentials.

[init/001-vector.sql](init/001-vector.sql) runs `CREATE EXTENSION IF NOT EXISTS vector` in `POSTGRES_DB` only when the data volume is first initialized. Existing volumes are not migrated and changing `.env` does not change existing database passwords. Apply approved future migrations explicitly rather than deleting data to rerun initialization. See the upstream [PostgreSQL image instructions](https://hub.docker.com/_/postgres) and [pgvector Docker instructions](https://github.com/pgvector/pgvector#docker).

## Development and validation

From the repository root, after preparing `.env`:

```bash
docker compose up -d --wait postgres
docker compose logs --tail=100 postgres
docker compose exec postgres sh -c 'pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose exec postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\\dx vector"'
```

`pg_isready` is the Compose probe; it checks that PostgreSQL accepts connections, not authentication, schema correctness or vector support. The last command must list the `vector` extension. No SQL unit or migration tests exist yet, and these runtime checks remain to be run after image startup.

Core API, Plugin APIs and workers may eventually use data owned by their service. Do not let shared credentials or direct database access bypass a Plugin API's organization and resource permission checks. The AI Orchestrator must retrieve only information authorized for the requesting user; vector similarity is not an authorization boundary.
