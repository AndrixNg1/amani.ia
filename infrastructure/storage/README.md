# MinIO / S3-compatible object storage

Status: local API/Console, healthcheck and persistent volume configured. No buckets,
service accounts, policies, uploads, customer documents or storage clients are created.
Runtime health, credentials and object permissions are **NOT RUN** in this phase.

## Configuration

The root Compose service `minio` retains image
`minio/minio:RELEASE.2025-09-07T16-13-09Z`, with `minio_data:/data`, internal
`dependencies` networking and manual restart behavior. Host ports are loopback-only:
API 9000 and Console 9001, configurable with `MINIO_API_PORT`/`MINIO_CONSOLE_PORT`.
`MINIO_ENDPOINT=http://127.0.0.1:9000` documents the host-side endpoint; update this
hint when changing the API port. Future containers use `http://minio:9000`.

`MINIO_ROOT_USER` is the local administrative access key; `MINIO_ROOT_PASSWORD` is
its secret key (at least eight characters). These credentials must never reach a
browser, Next public variable, client bundle or ordinary service deployment. Future
backends need service-scoped accounts and private bucket policies. Environment
credentials remain inspectable by the local Docker administrator.

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

The pinned release's [Dockerfile](https://github.com/minio/minio/blob/RELEASE.2025-09-07T16-13-09Z/Dockerfile.release)
includes curl for the probe. The [MinIO repository](https://github.com/minio/minio)
is archived; the existing local architecture is retained, with maintenance,
supported production storage and digest/provenance review still outstanding.
No production support or security guarantee is inferred from this image tag.
