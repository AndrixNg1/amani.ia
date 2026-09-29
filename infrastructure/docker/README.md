# Docker foundation

The root [docker-compose.yml](../../docker-compose.yml) is the only local infrastructure
entry point. This directory contains a dependency-free static checker and operational
documentation, not duplicate Compose files or application Dockerfiles.

## Prepared configuration

PostgreSQL/pgvector, Redis and MinIO share the `dependencies` bridge (`internal: true`).
Only loopback host ports 5432, 6379, 9000 and 9001 are published. Healthchecks and
three named persistent volumes are defined. `restart: "no"` makes startup/restart
explicit and keeps first-initialization errors visible. Compose does not start apps,
workers, proxy or monitoring services.

Redis follows its 7.4 Alpine series and PostgreSQL/pgvector retains its version tag.
MinIO uses a [local Dockerfile](../storage/minio/Dockerfile) and `pull_policy: build`:
Compose builds official pinned MinIO sources instead of pulling the unavailable
`minio/minio` image. This is a dependency image, not an application container.
Base image tags are not immutable digests. Full builds, architecture compatibility
and runtime probes remain owner-run; static checks do not prove runtime success.

## Static checks

```bash
npm run infra:config
npm run infra:check
npm run infra:test
```

`infra:config` resolves the public `.env.example` and checks Compose quietly.
[check.mjs](check.mjs) captures Compose JSON without printing environment values,
checks the service allowlist, ports, internal network, volumes, health definitions,
credential wiring, MinIO build configuration and shell syntax. It neither contacts running services nor executes
SQL, downloads images, or starts containers. It requires installed Docker Compose,
Node and Bash; no npm installation is necessary.

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

Startup is owner-only in this phase. `infra:down` removes containers/network while
retaining named volumes. There is no reset, prune or volume-removal helper. Existing
PostgreSQL volumes need reviewed migration rather than destructive reinitialization.
Full `docker compose config` output can contain credentials; prefer `--quiet`.

`infra:up` also builds MinIO automatically. The explicit build above separates first
compilation errors from service startup; subsequent builds use Docker's cache.
Use `docker compose pull postgres redis` if prefetching those dependencies. MinIO's
`amani-ia/minio:...-local` image is built locally and is not a published registry image.

Future independent application images must use the root npm lockfile/workspaces and
exclude `.env`, credentials, local dependencies and customer data from build contexts.
No application containerization, CI/CD, image publication or hosting is implemented.
