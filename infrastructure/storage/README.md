# MinIO / S3-compatible object storage

Status: local API/Console, healthcheck and persistent volume configured. No buckets,
service accounts, policies, uploads, customer documents or storage clients are created.
Runtime health, credentials and object permissions are **NOT RUN** in this phase.

## Configuration

The root Compose service `minio` builds the local image
`amani-ia/minio:RELEASE.2025-10-15T17-29-55Z-local`, with `minio_data:/data`, internal
`dependencies` networking and manual restart behavior. Host ports are loopback-only:
API 9000 and Console 9001, configurable with `MINIO_API_PORT`/`MINIO_CONSOLE_PORT`.
`MINIO_ENDPOINT=http://127.0.0.1:9000` documents the host-side endpoint; update this
hint when changing the API port. Future containers use `http://minio:9000`.

`MINIO_ROOT_USER` is the local administrative access key; `MINIO_ROOT_PASSWORD` is
its secret key (at least eight characters). These credentials must never reach a
browser, Next public variable, client bundle or ordinary service deployment. Future
backends need service-scoped accounts and private bucket policies. Environment
credentials remain inspectable by the local Docker administrator.

## Local image build and unavailable upstream image

The owner encountered `pull access denied` for the former Docker Hub image
`minio/minio:RELEASE.2025-09-07T16-13-09Z`. A manifest lookup for that release on
Quay also failed. The [upstream project](https://github.com/minio/minio#source-only-distribution)
now documents source-only distribution, so changing credentials or repeatedly
retrying the old image does not repair this dependency.

[minio/Dockerfile](minio/Dockerfile) builds official MinIO sources at
`RELEASE.2025-10-15T17-29-55Z` (commit
`9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a`). This updates the former September
release to the [October security release](https://github.com/minio/minio/releases/tag/RELEASE.2025-10-15T17-29-55Z),
which fixes a service-account/STS policy bypass. The source archive is checksum
verified; the builder uses Go 1.24.8 as declared by that release. The final Debian
image contains the server, license notices, CA certificates and curl for healthchecks.
No third-party MinIO binary or MinIO registry image is used.

Compose's `pull_policy: build` builds this image instead of requesting the local
tag from a registry. The context is only `infrastructure/storage/minio/` and excludes
local files; the root `.env` and service credentials never enter the build.
Credentials are supplied to the running service through Compose as before.

After configuring `.env`, run from the repository root:

```bash
npm run infra:check
docker compose config --quiet
docker compose build minio
npm run infra:up
npm run infra:status
```

The explicit build helps diagnose compilation separately; `infra:up` also builds
MinIO automatically and reuses Docker's build cache. The first build can take several
minutes and needs Internet access to Docker Hub, GitHub, Go module services and
Debian package repositories. No Go/Redis/MinIO installation on the host is required.
To prefetch PostgreSQL and Redis separately, use `docker compose pull postgres redis`.
Do not try `docker pull amani-ia/minio:...-local`: that name is a local build output.

Source/tag and base-image metadata checks do not prove the image builds or starts.
Full image construction and runtime checks remain **NOT RUN** during preparation;
the owner executes the commands above. Base images/packages are not fully pinned
by digest, so this is not a claim of bit-for-bit reproducible or production-ready builds.

## Future storage conventions

Reserve lowercase buckets by owner and purpose, such as `amani-knowledge-originals`,
`amani-data-analytics-datasets`, `amani-data-analytics-exports` and
`amani-evaluation-artifacts`. These are conventions, not provisioned resources.
Do not give all plugins shared root credentials or write permission across buckets.

Within a bucket, use a future path such as:

```text
organizations/<organizationId>/<resourceType>/<resourceId>/<version>/<artifact>
```

The organization/resource IDs must come from verified backend context. Paths and
bucket names are **not authorization**: each upload, read, download, deletion and
signed URL must be authorized by the owning backend. UI visibility is insufficient.
Private bucket policies, short-lived downloads, MIME/size checks, retention,
revocation, encryption, cleanup and backup/restore remain later implementation work.
Original documents/datasets and generated exports/artifacts belong here; their
business metadata and ACLs belong to the owning service's future PostgreSQL schema.

## Owner verification

After [manual stack startup](../README.md), these in-container checks require no
credentials and create no objects. They work even with changed published ports:

```bash
docker compose exec -T minio curl --fail --silent --show-error http://127.0.0.1:9000/minio/health/live
docker compose exec -T minio curl --fail --silent --show-error http://127.0.0.1:9000/minio/health/cluster
```

Expected: exit 0 and HTTP 200, usually an empty body. Liveness says the process
responds; the cluster probe checks write quorum. Neither proves bucket permissions
or successful upload/download. Open `http://127.0.0.1:9001` for the local Console
(adjust the port if overridden). `npm run infra:down` preserves stored objects.

The [MinIO repository](https://github.com/minio/minio) is archived. This local source
build retains the selected storage technology; maintenance, supported production
storage and digest/provenance review remain outstanding. No production support or
security guarantee is inferred from the selected release.
