# Core API

`@amani/core-api` — The intended home for organization and platform management. This workspace uses NestJS 11, TypeScript and the Express adapter. It currently contains the starter `GET /` route and a minimal `GET /health` endpoint.

## Responsibilities and relationships

Manage organizations, membership, permissions and plugin availability; expose the authorization contracts used by the other backend services.

The Gateway and AI Orchestrator will use Core API for platform capabilities. Plugin APIs must validate organization membership, entitlements and resource permissions through the agreed authorization contract.

These responsibilities describe the intended architecture. The current implementation does not perform business operations or make service-to-service requests. See the [repository overview](../../README.md) and [architecture documentation](../../docs/README.md).

## Local development

Follow the installation and prerequisite instructions in the [root README](../../README.md), including its reserved manual cleanup/install sequence. Install dependencies at the repository root after review; do not install separately inside this workspace.

Run from the repository root:

```bash
cp apps/core-api/.env.example apps/core-api/.env
npm run dev --workspace @amani/core-api
```

The service listens at `http://127.0.0.1:4001`. `dev` aliases the existing `start:dev` command. npm workspace commands run with this project's directory as the working directory. Startup loads that directory's optional `.env` with Node's built-in `process.loadEnvFile`; shell environment values take precedence. The repository-root `.env` configures infrastructure and is not loaded by this application. Node.js 22.17.0 is the repository baseline.

## Environment

| Variable | Default | Current behavior |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Network interface for the HTTP listener. Use `0.0.0.0` only when intentionally exposing the service, for example in a container. |
| `PORT` | `4001` | HTTP port; startup rejects values outside the integer range 1–65535. |


No database, Redis or object-storage adapter currently reads infrastructure connection settings. Coordinate future connection variables and credentials with the root infrastructure configuration; examples must never contain real credentials. Loopback URLs are for processes running on the host. Future containerized clients must use the appropriate Compose service names instead.

## Health and tests

```bash
curl --fail http://127.0.0.1:4001/health
npm run lint:check --workspace @amani/core-api
npm run typecheck --workspace @amani/core-api
npm run test --workspace @amani/core-api -- --runInBand
npm run test:e2e --workspace @amani/core-api -- --runInBand
npm run build --workspace @amani/core-api
# Start the compiled application after a successful build:
npm run start:prod --workspace @amani/core-api
```

`GET /health` returns HTTP 200 with `{"status":"ok","service":"@amani/core-api"}`. It is public process liveness only; it does not check PostgreSQL, pgvector, Redis, MinIO, downstream APIs, authorization or model providers. No readiness endpoint exists yet. `GET /` retains the starter `Hello World!` response.

The unit suite covers the starter controller. The e2e suite boots the Nest application and checks both HTTP routes, including the service identity in the health response. It does not start external infrastructure or prove tenant isolation. `typecheck` emits no files. `lint:check` is non-mutating and fails on warnings; the preserved `lint` script applies fixes. Existing `test:watch` and `test:cov` commands remain available.

## Security and implementation limits

Organization models, identity integration, authorization contracts and persistence are not implemented.

Future protected routes must authenticate the caller and enforce active organization membership and resource permissions. Forward only verified identity and organization context to other services; downstream Plugin APIs must independently enforce tenant isolation and user permissions. A service identity alone must not grant access to all tenant data.

There are no authentication guards or tenant-isolation controls in this scaffold. Do not connect real customer data or expose protected business operations before those controls and cross-tenant negative tests are implemented. Health success is not a security or production-readiness guarantee.

The package remains private and `UNLICENSED`. The Nest framework's license does not select a license for Amani IA; see [the license decision](../../docs/LICENSE-DECISION.md).
