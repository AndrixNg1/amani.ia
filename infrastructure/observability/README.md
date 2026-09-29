# Observability foundation

Status: conventions and local diagnostics only. No logging library, collector,
agent, dashboard, metrics backend, monitoring volume or extra port is installed.
No Prometheus, Grafana, Loki, Jaeger or OpenTelemetry Collector is added.

## Future structured log contract

Use one JSON object per event with a bounded, predictable shape:

| Field | Meaning / rule |
| --- | --- |
| `timestamp` | UTC ISO 8601 event time |
| `level` | Bounded severity vocabulary such as debug/info/warn/error |
| `service` | Stable service identity, e.g. `@amani/knowledge` |
| `environment` | Local/test/staging/production label, never a secret |
| `event` | Stable machine-readable event name |
| `requestId`, `correlationId` | Validated bounded identifiers; absent for operations without request context |
| `organizationId` | Only when necessary and policy permits; opaque/pseudonymized where appropriate |
| `traceId`, `spanId` | Future validated tracing context, when instrumentation is selected |
| `error.code`, `error.category` | Stable sanitized metadata; no raw exception/payload by default |
| `durationMs`, `outcome` | Bounded numeric measurement and result label when useful |

Do not log authentication tokens, Authorization/Cookie headers, credentials, database
URLs containing secrets, presigned URLs, raw prompts/documents, dataset contents or
unnecessary personal data. A request/correlation ID is not an identity proof.
Untrusted incoming trace/header values need validation before propagation; the
existing `@amani/shared` helpers may be integrated later, but no app is changed now.

Trace propagation across Gateway, Core, Orchestrator, plugins and future jobs must
preserve correlation and tenant boundaries. Select tracing libraries/backends later
under ADR-0028; do not invent an active OpenTelemetry pipeline. Telemetry must not
broaden resource access, create an unbounded per-tenant metric cardinality, or make
logs a copy of private business data. Retention, access controls, redaction tests,
quotas and alerts remain future work. Business audit integrity is a separate concern.

## Local diagnostics and limits

```bash
npm run infra:status
npm run infra:logs
```

These owner commands apply only after manual startup. Health definitions are in
Compose: PostgreSQL connection acceptance, authenticated Redis responsiveness and
MinIO liveness. They do not establish application readiness, tenant isolation or
working business requests. PostgreSQL privilege/auth checks are separately available
through `npm run infra:verify:postgres`, not a continuous monitor.

No environment variables specific to observability exist yet. Startup/shutdown,
ports and persistent volumes belong to the [dependency stack](../README.md).
No observability runtime test was run; future work includes instrumentation, log
redaction tests, SLOs, alerting and production operations after actual service behavior
exists. Cloud/monitoring examples in diagram 18 remain illustrative, not deployed.
