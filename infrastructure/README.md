# Infrastructure

The root [Docker Compose file](../docker-compose.yml) provides PostgreSQL with pgvector, Redis and MinIO for local development. Applications and Plugin APIs run on the host through npm. No application containers, migrations, buckets, service accounts, reverse proxy or monitoring stack are provisioned.

## Components and responsibilities

| Component | Technology | Host address | Status |
| --- | --- | --- | --- |
| [PostgreSQL](postgres/README.md) | PostgreSQL 17, pgvector 0.8.6 | `127.0.0.1:5432` | Named volume and extension initialization |
| [Redis](redis/README.md) | Redis 7.4, Alpine image | `127.0.0.1:6379` | Password and append-only persistence |
| [Storage](storage/README.md) | MinIO, S3-compatible storage | `127.0.0.1:9000`; console `127.0.0.1:9001` | Named volume; no buckets or application credentials |
| [Docker](docker/README.md) | Docker Compose | No additional port | Deployment placeholder; dependencies configured at root |
| [Gateway](gateway/README.md) | Not selected | None | Edge infrastructure placeholder |
| [Observability](observability/README.md) | Not selected | None | Instrumentation and monitoring placeholder |

Backend access to these dependencies is planned; the current NestJS scaffolds do not yet connect to them. Frontends must communicate with backend APIs, never directly with these dependencies. Database records, Redis keys and object access must eventually be scoped by validated organization and user permissions; infrastructure credentials do not enforce application tenant isolation.

## Environment and local commands

Run commands at the repository root. Copy `.env.example` to `.env` if the file does not already exist, replace its placeholder passwords and keep it untracked. Application environment files are separate; Compose loads the root `.env` for interpolation, while npm does not automatically load it.

`POSTGRES_DB` and `POSTGRES_USER` default to `amani`. Required values are `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`; Compose rejects missing or empty values. `POSTGRES_PORT`, `REDIS_PORT`, `MINIO_API_PORT` and `MINIO_CONSOLE_PORT` override host ports. Update any future application connection strings when changing credentials or ports. All published ports bind to loopback.

```bash
# Check configuration without printing resolved credentials or starting containers.
docker compose --env-file .env.example config --quiet

# After preparing your private .env; these commands may pull images.
docker compose up -d --wait
docker compose ps
docker compose logs --tail=100 postgres redis minio

# Stop and remove containers; named data volumes remain.
docker compose down
```

Use `127.0.0.1` and the published ports from host processes. Future containers on the Compose network would use `postgres:5432`, `redis:6379` and `http://minio:9000`; `localhost` inside a container points back to that container. The Compose network alone does not establish service identity or user authorization.

## Checks and limitations

Compose probes use PostgreSQL `pg_isready`, an authenticated Redis `PING`, and MinIO `/minio/health/live`. They check connection acceptance, authenticated response and HTTP liveness respectively. They do not validate application migrations, pgvector availability, tenant policies, object permissions or end-to-end readiness. Component READMEs provide manual follow-up checks. There is no infrastructure automated test suite yet, and runtime startup must still be verified locally.

The pgvector image pins the extension version and PostgreSQL major version; the Redis tag follows the 7.4 Alpine series; MinIO uses a dated release tag. None is pinned by digest, and these tags are not a production support or security guarantee. The [MinIO upstream repository](https://github.com/minio/minio) is archived; this existing architecture is retained for local development, with its maintenance and deployment plan still to be decided. Review image provenance, supported versions and digests before production use. No images were pulled or containers started during repository preparation.

Named volumes keep local data outside Git. Do not use real customer data here. Changing `.env` does not rotate credentials already stored in PostgreSQL; the database initialization scripts run only on an empty data directory. Backups, restore procedures, TLS, narrowly scoped service accounts and deployment configuration are not implemented.

Compose's required-variable syntax and healthcheck behavior follow the [Docker interpolation reference](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/) and [service reference](https://docs.docker.com/reference/compose-file/services/).
