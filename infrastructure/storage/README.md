# Object storage

MinIO supplies the S3-compatible local dependency planned for documents, uploads and generated artifacts. The `minio` Compose service persists objects in `minio_data`. Buckets, application service accounts, policies, upload flows and SDK integration are not implemented.

## Environment and development

The root `.env` requires `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` (at least eight characters). Optional `MINIO_API_PORT=9000` and `MINIO_CONSOLE_PORT=9001` control loopback host ports. Root credentials are local administrative bootstrap credentials; future applications need narrowly scoped credentials and private buckets.

Run from the repository root after preparing `.env`:

```bash
docker compose up -d --wait minio
docker compose logs --tail=100 minio
curl --fail http://127.0.0.1:9000/minio/health/live
curl --fail http://127.0.0.1:9000/minio/health/cluster
```

Open `http://127.0.0.1:9001` for the console. Host SDKs will use `http://127.0.0.1:9000`; future Compose clients use `http://minio:9000`. Adjust the manual URLs if overriding host ports. `localhost` inside a different container is not this service.

The Compose probe checks HTTP liveness; `/minio/health/cluster` additionally checks write quorum. Neither proves that a bucket exists or that application credentials can upload and read objects. The [upstream healthcheck documentation](https://github.com/minio/minio/blob/master/docs/metrics/healthcheck/README.md) describes those distinctions. No automated S3 integration tests exist, and runtime checks remain pending.

The image tag `RELEASE.2025-09-07T16-13-09Z` is a dated release, not a digest pin. Its [release Dockerfile](https://github.com/minio/minio/blob/RELEASE.2025-09-07T16-13-09Z/Dockerfile.release) includes the `curl` executable used by the probe. The [upstream repository](https://github.com/minio/minio) is archived; this is a local development dependency, with future maintenance and production deployment decisions outstanding.

Plugin APIs and workers will mediate object access using authenticated tenant and user context. Object names or organization prefixes alone are not authorization; APIs must check permissions before issuing scoped uploads, downloads or signed URLs. Never expose root credentials through frontend environment variables. See [infrastructure overview](../README.md) for lifecycle and persistence behavior.
