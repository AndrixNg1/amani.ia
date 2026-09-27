# AI Orchestrator

`@amani/ai-orchestrator` — The intended coordinator for AI requests and calls to independent Plugin APIs. This workspace uses NestJS 11, TypeScript and the Express adapter. It currently contains the starter `GET /` route and a minimal `GET /health` endpoint.

## Responsibilities and relationships

Plan and execute authorized plugin calls and construct model context exclusively from data the requesting user may access.

The Gateway will submit AI requests. Core API will provide organization and authorization context; the five Plugin APIs will provide domain capabilities. No HTTP clients or model providers exist yet.

These responsibilities describe the intended architecture. The current implementation does not perform business operations or make service-to-service requests. See the [repository overview](../../README.md) and [architecture documentation](../../docs/README.md).

## Local development

Follow the installation and prerequisite instructions in the [root README](../../README.md), including its reserved manual cleanup/install sequence. Install dependencies at the repository root after review; do not install separately inside this workspace.

Run from the repository root:

```bash
cp apps/ai-orchestrator/.env.example apps/ai-orchestrator/.env
npm run dev --workspace @amani/ai-orchestrator
```

The service listens at `http://127.0.0.1:4002`. `dev` aliases the existing `start:dev` command. npm workspace commands run with this project's directory as the working directory. Startup loads that directory's optional `.env` with Node's built-in `process.loadEnvFile`; shell environment values take precedence. The repository-root `.env` configures infrastructure and is not loaded by this application. Node.js 22.17.0 is the repository baseline.

## Environment

| Variable | Default | Current behavior |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Network interface for the HTTP listener. Use `0.0.0.0` only when intentionally exposing the service, for example in a container. |
| `PORT` | `4002` | HTTP port; startup rejects values outside the integer range 1–65535. |
| `CORE_API_URL` | Suggested `http://127.0.0.1:4001` | Reserved, commented example for a future service client; not currently read. |
| `KNOWLEDGE_API_URL` | Suggested `http://127.0.0.1:4101` | Reserved, commented example for a future service client; not currently read. |
| `DATA_ANALYTICS_API_URL` | Suggested `http://127.0.0.1:4102` | Reserved, commented example for a future service client; not currently read. |
| `CONVERSATIONS_API_URL` | Suggested `http://127.0.0.1:4103` | Reserved, commented example for a future service client; not currently read. |
| `CONNECTORS_API_URL` | Suggested `http://127.0.0.1:4104` | Reserved, commented example for a future service client; not currently read. |
| `EVALUATION_API_URL` | Suggested `http://127.0.0.1:4105` | Reserved, commented example for a future service client; not currently read. |


No database, Redis or object-storage adapter currently reads infrastructure connection settings. Coordinate future connection variables and credentials with the root infrastructure configuration; examples must never contain real credentials. Loopback URLs are for processes running on the host. Future containerized clients must use the appropriate Compose service names instead.

## Health and tests

```bash
curl --fail http://127.0.0.1:4002/health
npm run lint:check --workspace @amani/ai-orchestrator
npm run typecheck --workspace @amani/ai-orchestrator
npm run test --workspace @amani/ai-orchestrator -- --runInBand
npm run test:e2e --workspace @amani/ai-orchestrator -- --runInBand
npm run build --workspace @amani/ai-orchestrator
# Start the compiled application after a successful build:
npm run start:prod --workspace @amani/ai-orchestrator
```

`GET /health` returns HTTP 200 with `{"status":"ok","service":"@amani/ai-orchestrator"}`. It is public process liveness only; it does not check PostgreSQL, pgvector, Redis, MinIO, downstream APIs, authorization or model providers. No readiness endpoint exists yet. `GET /` retains the starter `Hello World!` response.

The unit suite covers the starter controller. The e2e suite boots the Nest application and checks both HTTP routes, including the service identity in the health response. It does not start external infrastructure or prove tenant isolation. `typecheck` emits no files. `lint:check` is non-mutating and fails on warnings; the preserved `lint` script applies fixes. Existing `test:watch` and `test:cov` commands remain available.

## Security and implementation limits

Model integration, orchestration, authorization-aware retrieval and service clients are not implemented. Never retrieve all tenant data and filter it only after model context construction.

Future protected routes must authenticate the caller and enforce active organization membership and resource permissions. Forward only verified identity and organization context to other services; downstream Plugin APIs must independently enforce tenant isolation and user permissions. A service identity alone must not grant access to all tenant data.

There are no authentication guards or tenant-isolation controls in this scaffold. Do not connect real customer data or expose protected business operations before those controls and cross-tenant negative tests are implemented. Health success is not a security or production-readiness guarantee.

The package remains private and `UNLICENSED`. The Nest framework's license does not select a license for Amani IA; see [the license decision](../../docs/LICENSE-DECISION.md).
