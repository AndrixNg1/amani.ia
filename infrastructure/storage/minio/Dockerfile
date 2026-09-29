# syntax=docker/dockerfile:1
# Build official sources; the former upstream MinIO images are unavailable.
FROM golang:1.24.8-bookworm AS build

ENV CGO_ENABLED=0 GOTOOLCHAIN=local

# This module version resolves to upstream release RELEASE.2025-10-15T17-29-55Z,
# commit 9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a. Go verifies module checksums.
RUN GOBIN=/out go install -tags kqueue -trimpath \
    -ldflags="-s -w -X github.com/minio/minio/cmd.Version=2025-10-15T17:29:55Z -X github.com/minio/minio/cmd.ReleaseTag=RELEASE.2025-10-15T17-29-55Z -X github.com/minio/minio/cmd.CommitID=9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a -X github.com/minio/minio/cmd.ShortCommitID=9e49d5e7a648 -X github.com/minio/minio/cmd.CopyrightYear=2025" \
    github.com/minio/minio@v0.0.0-20251015172955-9e49d5e7a648 \
    && mkdir -p /out/licenses \
    && cp /go/pkg/mod/github.com/minio/minio@v0.0.0-20251015172955-9e49d5e7a648/LICENSE /out/licenses/LICENSE \
    && cp /go/pkg/mod/github.com/minio/minio@v0.0.0-20251015172955-9e49d5e7a648/NOTICE /out/licenses/NOTICE

FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data

COPY --from=build /out/minio /usr/local/bin/minio
COPY --from=build /out/licenses/ /usr/share/licenses/minio/

LABEL org.opencontainers.image.source="https://github.com/minio/minio" \
      org.opencontainers.image.version="RELEASE.2025-10-15T17-29-55Z" \
      org.opencontainers.image.revision="9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a" \
      org.opencontainers.image.licenses="AGPL-3.0-only"

EXPOSE 9000 9001
WORKDIR /data
ENTRYPOINT ["/usr/local/bin/minio"]
CMD ["server", "/data", "--console-address", ":9001"]
