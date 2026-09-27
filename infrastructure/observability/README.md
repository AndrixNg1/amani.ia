# Observability placeholder

This directory reserves shared logging, metrics, tracing and alerting configuration. No collector, dashboard, metrics backend or monitoring technology has been selected or configured. No monitoring service is added to Compose.

There are no environment variables, development commands or automated tests for this directory yet. For local diagnostics, run `docker compose ps` and `docker compose logs --tail=100 postgres redis minio` from the repository root, and consult each application's README for its health endpoint and test commands.

Dependency probes are described in [infrastructure](../README.md). A process liveness response does not establish dependency readiness, correct tenant authorization or a working user request. Future instrumentation should connect gateway, Core API, AI Orchestrator, Plugin APIs and workers through trace identifiers without recording credentials, prompts or customer content by default. Production telemetry access, retention and readiness probes remain unimplemented.
