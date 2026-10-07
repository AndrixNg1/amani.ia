# Docker foundation

The root [docker-compose.yml](../../docker-compose.yml) is the only local infrastructure
entry point. This directory contains a dependency-free static checker and operational
documentation, not duplicate Compose files or application Dockerfiles.

## Prepared configuration

PostgreSQL/pgvector, Redis and MinIO share the `dependencies` bridge (`internal: true`).
They also attach to the non-internal `host_access` bridge so Docker can publish ports
on the host. An internal-only attachment left published ports unset during owner
startup. The added bridge allows outbound traffic; no global egress block is claimed.
Only loopback host ports 5432, 6379, 9000 and 9001 are published. Healthchecks and
three named persistent volumes are defined. `restart: "no"` makes startup/restart
explicit and keeps first-initialization errors visible. Compose does not start apps,
workers, proxy or monitoring services.

Redis follows its 7.4 Alpine series and PostgreSQL/pgvector retains its version tag.
MinIO uses a [local Dockerfile](../storage/minio/Dockerfile) and `pull_policy: build`:
Compose builds official pinned MinIO sources instead of pulling the unavailable
`minio/minio` image. This is a dependency image, not an application container.
Base image tags are not immutable digests. The owner completed the MinIO build,
all three services reached healthy, loopback mappings appeared on the host, and
PostgreSQL role/schema/authentication verification passed. See the
[recorded validation](../README.md#recorded-local-validation) for the scope and limits;
static checks alone do not prove runtime success.

## Static checks

```bash
npm run infra:config
npm run infra:check
npm run infra:check:local
npm run infra:test
```

`infra:config` resolves the public `.env.example` and checks Compose quietly.
[check.mjs](check.mjs) captures Compose JSON without printing environment values,
checks the service allowlist, ports, both networks, volumes, health definitions,
credential wiring, MinIO build configuration and shell syntax. It neither contacts
running services nor executes
SQL, downloads images, or starts containers. It requires installed Docker Compose,
Node and Bash; no npm installation is necessary.

`infra:check:local` checks the real `.env` without printing values. It also rejects
duplicate PostgreSQL administrator/service passwords before the first startup can
leave a partially initialized volume. `infra:up` invokes this check automatically.

`infra:test` exercises the bootstrap shell boundary with a fake SQL client, including
missing/reused passwords, forbidden administrator names and secret-safe failures.
It does not validate SQL execution; PostgreSQL runtime checks remain owner-run.

## Owner lifecycle

See [infrastructure setup](../README.md) for credential preparation and expected results.

```bash
docker compose config --quiet
docker compose build minio
npm run infra:up
npm run infra:status
npm run infra:logs
npm run infra:verify:postgres
npm run infra:down
```

Startup is owner-run. `infra:down` removes containers/network while
retaining named volumes. There is no reset, prune or volume-removal helper. Existing
PostgreSQL volumes need reviewed migration rather than destructive reinitialization.
Full `docker compose config` output can contain credentials; prefer `--quiet`.

If startup reports `failed to bind host port ... address already in use`, inspect
listeners with `ss -ltn` and choose free host ports in the root `.env`. For example,
`POSTGRES_PORT=15432` and `REDIS_PORT=16379` avoid occupied 5432/6379 on the owner's
machine. Do not stop unrelated services to free those ports. Containers still use
5432/6379 internally; host clients such as SQLTools use the chosen published ports.
PostgreSQL's in-container bootstrap/verification commands do not change.

Once all images are already available, `npm run infra:up -- --no-build --pull never`
applies configuration changes without another image build or pull. It still performs
the local configuration check and preserves named volumes.

`infra:up` also builds MinIO automatically. The explicit build above separates first
compilation errors from service startup; subsequent builds use Docker's cache.
Use `docker compose pull postgres redis` if prefetching those dependencies. MinIO's
`amani-ia/minio:...-local` image is built locally and is not a published registry image.

Future independent application images must use the root npm lockfile/workspaces and
exclude `.env`, credentials, local dependencies and customer data from build contexts.
No application containerization, CI/CD, image publication or hosting is implemented.
