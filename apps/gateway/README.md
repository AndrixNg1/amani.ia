# Gateway

`@amani/gateway` — The intended HTTP entry point for the Amani IA frontends. This workspace uses NestJS 11, TypeScript and the Express adapter. It currently contains the starter `GET /` route and a minimal `GET /health` endpoint.

## Responsibilities and relationships

Route authenticated requests to Core API and the AI Orchestrator, propagate verified user and organization context, and apply request-level controls.

The admin, enterprise and website frontends are expected to reach backend capabilities through this gateway. Downstream routing is not implemented.

These responsibilities describe the intended architecture. The current implementation does not perform business operations or make service-to-service requests. See the [repository overview](../../README.md) and [architecture documentation](../../docs/README.md).

## Local development

Follow the installation and prerequisite instructions in the [root README](../../README.md), including its reserved manual cleanup/install sequence. Install dependencies at the repository root after review; do not install separately inside this workspace.

Run from the repository root:

```bash
cp apps/gateway/.env.example apps/gateway/.env
npm run dev --workspace @amani/gateway
```

The service listens at `http://127.0.0.1:4000`. `dev` aliases the existing `start:dev` command. npm workspace commands run with this project's directory as the working directory. Startup loads that directory's optional `.env` with Node's built-in `process.loadEnvFile`; shell environment values take precedence. The repository-root `.env` configures infrastructure and is not loaded by this application. Node.js 22.17.0 is the repository baseline.

## Environment

| Variable | Default | Current behavior |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Network interface for the HTTP listener. Use `0.0.0.0` only when intentionally exposing the service, for example in a container. |
| `PORT` | `4000` | HTTP port; startup rejects values outside the integer range 1–65535. |
| `CORE_API_URL` | Suggested `http://127.0.0.1:4001` | Reserved, commented example for a future service client; not currently read. |
| `AI_ORCHESTRATOR_URL` | Suggested `http://127.0.0.1:4002` | Reserved, commented example for a future service client; not currently read. |


No database, Redis or object-storage adapter currently reads infrastructure connection settings. Coordinate future connection variables and credentials with the root infrastructure configuration; examples must never contain real credentials. Loopback URLs are for processes running on the host. Future containerized clients must use the appropriate Compose service names instead.

## Health and tests

```bash
curl --fail http://127.0.0.1:4000/health
npm run lint:check --workspace @amani/gateway
npm run typecheck --workspace @amani/gateway
npm run test --workspace @amani/gateway -- --runInBand
npm run test:e2e --workspace @amani/gateway -- --runInBand
npm run build --workspace @amani/gateway
# Start the compiled application after a successful build:
npm run start:prod --workspace @amani/gateway
```

`GET /health` returns HTTP 200 with `{"status":"ok","service":"@amani/gateway"}`. It is public process liveness only; it does not check PostgreSQL, pgvector, Redis, MinIO, downstream APIs, authorization or model providers. No readiness endpoint exists yet. `GET /` retains the starter `Hello World!` response.

The unit suite covers the starter controller. The e2e suite boots the Nest application and checks both HTTP routes, including the service identity in the health response. It does not start external infrastructure or prove tenant isolation. `typecheck` emits no files. `lint:check` is non-mutating and fails on warnings; the preserved `lint` script applies fixes. Existing `test:watch` and `test:cov` commands remain available.

## Security and implementation limits

Authentication, request forwarding, rate limits and organization context propagation are not implemented.

Future protected routes must authenticate the caller and enforce active organization membership and resource permissions. Forward only verified identity and organization context to other services; downstream Plugin APIs must independently enforce tenant isolation and user permissions. A service identity alone must not grant access to all tenant data.

There are no authentication guards or tenant-isolation controls in this scaffold. Do not connect real customer data or expose protected business operations before those controls and cross-tenant negative tests are implemented. Health success is not a security or production-readiness guarantee.

The package remains private and `UNLICENSED`. The Nest framework's license does not select a license for Amani IA; see [the license decision](../../docs/LICENSE-DECISION.md).
