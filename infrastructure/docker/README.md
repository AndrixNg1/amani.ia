# Docker configuration

This directory reserves a home for future application container build and deployment configuration. It currently has no Dockerfiles, build contexts or runnable application images. The existing [root Compose file](../../docker-compose.yml) is the only container configuration and starts local PostgreSQL, Redis and MinIO dependencies.

Technology in use is Docker Engine with the Docker Compose plugin. There are no environment variables specific to this directory; the root `.env.example` documents dependency credentials and host ports. Application processes run through npm workspaces on the host.

From the repository root, `docker compose --env-file .env.example config --quiet` validates dependency configuration without starting containers. After preparing a private `.env`, `docker compose up -d --wait` starts them and `docker compose down` stops them while preserving named volumes. See the [infrastructure README](../README.md) for complete commands and healthcheck limits.

There is no application image build or image test command yet. Future Dockerfiles must fit the npm workspace build layout and exclude secrets, local dependencies and customer data from build contexts. Image publishing and production deployment remain unimplemented.
