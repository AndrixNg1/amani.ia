# Infrastructure — Phase 2

Status: local infrastructure configuration and bootstrap/verification scripts are
prepared. Static checks were run; no images were pulled, containers started or SQL
executed in this phase. No application, plugin or worker was implemented.

## Local topology

The root [docker-compose.yml](../docker-compose.yml) is the single entry point.
Applications will run on the host via npm; Compose contains dependencies only.

| Service | Image | Host address | Persistent volume | Probe |
| --- | --- | --- | --- | --- |
| PostgreSQL | `pgvector/pgvector:0.8.6-pg17-bookworm` | `127.0.0.1:5432` | `postgres_data` | `pg_isready` |
| Redis | `redis:7.4-alpine` | `127.0.0.1:6379` | `redis_data` | Authenticated `PING` |
| MinIO | `minio/minio:RELEASE.2025-09-07T16-13-09Z` | API `127.0.0.1:9000`, Console `127.0.0.1:9001` | `minio_data` | HTTP `/minio/health/live` |

All three attach only to the Compose-managed `dependencies` bridge with
`internal: true`. It isolates container egress; published host ports stay loopback
only. Internal networking is not authentication. Host clients use the addresses
above; future network-attached containers use `postgres:5432`, `redis:6379`,
`http://minio:9000`. Ports and network reachability still require runtime validation.
See [Docker network options](https://docs.docker.com/reference/compose-file/networks/).

`restart: "no"` is intentional for local development: containers start/restart only
when the owner asks, and initialization failure stays visible. Automatically
restarting PostgreSQL after failed first-time initialization can hide a partial
setup. No application containers, proxy, monitoring stack or destructive reset
script are added. Images retain the existing tags, not digest pins.

## Environment and credentials

The root [.env.example](../.env.example) is public placeholder configuration.
Copy it only if `.env` is absent; otherwise merge the new keys manually. Never
print resolved Compose configuration containing real credentials; use `--quiet`.
Do not source dotenv files as shell scripts. Single-quote dotenv values containing
`$` or `#`, and use distinct random local credentials.

| Variables | Consumer / boundary |
| --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Initial database/admin creation; admin credentials never used by applications |
| `CORE_PLATFORM_DB_PASSWORD`, `KNOWLEDGE_DB_PASSWORD`, `DATA_ANALYTICS_DB_PASSWORD`, `CONVERSATIONS_DB_PASSWORD`, `CONNECTORS_DB_PASSWORD`, `EVALUATION_DB_PASSWORD` | Fresh-volume creation of six service logins; each future service receives only its own credential |
| `POSTGRES_PORT`, `REDIS_PORT`, `MINIO_API_PORT`, `MINIO_CONSOLE_PORT` | Published loopback ports |
| `REDIS_PASSWORD` | Shared local bootstrap password; service ACLs are not implemented |
| `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` | Local administrative access/secret key; future clients need restricted accounts |
| `POSTGRES_HOST`, `REDIS_HOST`, `MINIO_ENDPOINT` | Host-side connection hints for later consumers; not bind-address overrides and not automatically loaded by apps |

Everything here is local development configuration. Credentials are server-side
only and forbidden from `NEXT_PUBLIC_*`, browser bundles, repository files and
logs. Compose receives the six database passwords so the local administrator can
bootstrap roles; this does not mean each application should receive the root `.env`.
People with host/Docker administrator access can inspect container environments.
No production secret-management system is claimed.

## Manual startup and verification

Run from the repository root. These commands are for the owner, not actions already
performed during preparation. Review [existing-volume handling](postgres/README.md)
before startup if a PostgreSQL volume already exists; entrypoint scripts will not
migrate it automatically.

```bash
if [ ! -f .env ]; then (umask 077; cp .env.example .env); fi
# Edit .env: merge missing variables and replace every placeholder password.
chmod 600 .env
npm run infra:config
npm run infra:check
npm run infra:test
docker compose config --quiet
npm run infra:up
npm run infra:status
npm run infra:verify:postgres
docker compose exec -T redis sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping'
docker compose exec -T minio curl --fail --silent --show-error http://127.0.0.1:9000/minio/health/live
docker compose exec -T minio curl --fail --silent --show-error http://127.0.0.1:9000/minio/health/cluster
npm run infra:logs
```

Expected: configuration exits 0; three containers become healthy; PostgreSQL
verification prints six owned schemas, pgvector in `extensions`, and six successful
login/wrong-password checks; Redis returns `PONG`; MinIO probes return HTTP 200
(often with an empty body). The Console is at `http://127.0.0.1:9001` by default.
In-container probes above also work when published host ports are changed.

`infra:test` runs seven shell-boundary tests using a fake `psql` in an isolated
temporary directory. It checks preflight rejection and secret-safe failure handling,
without executing SQL or contacting any database/container. Passing it does not
prove bootstrap SQL or database isolation at runtime.

`infra:verify:postgres` is read-only: it checks catalogs and authenticates each
service over TCP. It creates no table, test row or business object. Read-only checks
of schema USAGE/CREATE rights establish the prepared namespace boundary; full
business query/RLS tests belong to future migrations and services.

```bash
# Stop/remove containers and the network; preserve all named volumes.
npm run infra:down
```

Do not remove volumes to force initialization. Volumes retain SQL data, Redis AOF
and objects across ordinary shutdown. They are not backups.

## Implemented versus planned

Prepared: scoped SQL logins/schemas/default privileges, restricted pgvector namespace,
SCRAM on fresh host-auth configuration, health definitions, network/ports, persistence,
static checks, manual verification and naming/logging conventions.

Planned: business tables/migrations, service clients, per-tenant authorization/RLS,
service-to-service authentication, Redis ACLs, private buckets/accounts/policies,
queues/workers, TLS, backups/restores, production credentials and observability tools.
Schema ownership does not isolate organizations inside a service. The local schema
owner can perform DDL in its own schema; split migration/runtime accounts before
production. The bootstrap administrator remains privileged by design.

## ADR and diagram audit

All 30 ADRs and architecture documentation were reviewed. Existing accepted service
ownership and multi-tenant principles are retained; no proposed protocol is promoted
to an accepted implementation.

- Diagram **05** draws Python consuming a BullMQ/queue layer. ADR-0006/0024 require
  an explicit interoperable contract; no Python/BullMQ coupling is implemented.
- Diagram **06** mentions schemas per service and tenant and shows business tables.
  This foundation creates schemas per service only. Tenant filtering/authorization
  is future application work; no schema per organization or illustrated table is created.
- Diagram **18** illustrates Kubernetes, Vercel, cloud providers, Pinecone and monitoring.
  ADR-0008/0028/0029 retain pgvector and leave production vendors/tools open. These
  illustrations do not justify provisioning them now.
- Historical architecture tables still describe packages as placeholders. Phase 1
  implemented four packages; see [packages](../packages/README.md). Historical ADRs
  and diagrams are not rewritten as part of this infrastructure task.

See [PostgreSQL](postgres/README.md), [Redis](redis/README.md),
[storage](storage/README.md), [Docker](docker/README.md),
[gateway](gateway/README.md) and [observability](observability/README.md).
