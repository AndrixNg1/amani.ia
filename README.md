# Amani IA

Amani IA is a multi-tenant, plugin-based AI SaaS organized as an npm monorepo.
The repository contains three NestJS platform services, five independent NestJS
Plugin APIs and three Next.js frontends. Four shared packages, local infrastructure,
Core Platform persistence/authorization and explicit Gateway routing are implemented.

**Current status:** Core owns tenant policy and platform data;
Gateway applies HTTP controls and calls Core with bounded context. Both services deny
business calls by default. Authentication adapters are local-development-only;
production IAM and service authentication remain architecture decisions. Plugins,
workers, Orchestrator and frontend business features remain future work. Component
READMEs describe configuration, commands and tests.

## Architecture

The intended request flow is frontend → Gateway → Core API / AI Orchestrator /
Plugin APIs. Plugins are independent backend services; the Orchestrator must obtain
data through APIs that enforce the requesting user's organization membership and
resource permissions. Gateway → Core calls are implemented for controlled local development. Other
backend integrations remain planned.

```mermaid
flowchart LR
    UI[Website / Enterprise / Admin] -. planned .-> Gateway
    Gateway -->|local development authentication| Core[Core API]
    Core -->|owned schema| PG
    Gateway -. planned .-> AI[AI Orchestrator]
    Gateway -. planned .-> Plugins[Five independent Plugin APIs]
    AI -. authorized requests only — planned .-> Plugins
    Plugins -. planned .-> PG[(PostgreSQL + pgvector)]
    Plugins -. planned .-> Redis[(Redis)]
    Plugins -. planned .-> MinIO[(MinIO)]
```

See [architecture and implementation status](docs/architecture/README.md),
[documentation index](docs/README.md) and [infrastructure](infrastructure/README.md).
Compose provisions local dependencies only; no application containers are added.

## Repository structure

| Directory | Contents and status |
| --- | --- |
| `apps/` | Gateway, Core API, AI Orchestrator, Admin, Enterprise, Website; initialized |
| `plugins/` | Knowledge, Data Analytics, Conversations, Connectors, Evaluation; initialized |
| `packages/` | `config`, `contracts`, `shared`, `types` implemented; `prompts`, `sdk`, `ui` reserved |
| `workers/` | `data-engine`, `document-processing`; not initialized |
| `infrastructure/` | Local PostgreSQL, Redis, storage configuration; Docker, gateway, observability documentation |
| `docs/` | Architecture, diagrams, decision status and license decision |
| `scripts/` | Dependency-free structural inspection |
| `tests/` | Planned integration, contract and cross-service end-to-end test directories |

Each existing component has a README describing its actual status, responsibilities,
environment, commands, tests and service relationships.

## Prerequisites and workspaces

Use Node.js **22.17.0** (`.nvmrc`) and npm **10.9.x**, plus Docker Engine and Docker
Compose v2 or newer for local dependencies. The manifest accepts Node 22.17+ within
22.x and npm 10.9.2+ within 10.x. These are the setup baseline, not a claim that
other versions cannot work. Git, a POSIX shell, `find` and `curl` support the manual
workflow below. The existing Next.js layout fetches Google Geist fonts during
builds and therefore needs network access.

The root `package.json` is the workspace source of truth:

```json
"workspaces": ["apps/*", "plugins/*", "packages/*"]
```

Only directories with a `package.json` are npm packages. There are currently
**15 initialized workspaces**, including **four shared packages**. New shared
packages must use `@amani/<name>` and real check scripts. Workers are not npm
workspaces until their runtime and initialization are decided. The obsolete
`npm-workspace.yaml` has been removed. See the [npm workspace documentation](https://docs.npmjs.com/cli/v10/using-npm/workspaces/).

| Workspace | Path | Local port | Root development command |
| --- | --- | ---: | --- |
| `@amani/website` | `apps/website` | 3000 | `npm run dev:website` |
| `@amani/enterprise` | `apps/enterprise` | 3001 | `npm run dev:enterprise` |
| `@amani/admin` | `apps/admin` | 3002 | `npm run dev:admin` |
| `@amani/gateway` | `apps/gateway` | 4000 | `npm run dev:gateway` |
| `@amani/core-api` | `apps/core-api` | 4001 | `npm run dev:core` |
| `@amani/ai-orchestrator` | `apps/ai-orchestrator` | 4002 | `npm run dev:orchestrator` |
| `@amani/knowledge` | `plugins/knowledge` | 4101 | `npm run dev:knowledge` |
| `@amani/data-analytics` | `plugins/data-analytics` | 4102 | `npm run dev:data-analytics` |
| `@amani/conversations` | `plugins/conversations` | 4103 | `npm run dev:conversations` |
| `@amani/connectors` | `plugins/connectors` | 4104 | `npm run dev:connectors` |
| `@amani/evaluation` | `plugins/evaluation` | 4105 | `npm run dev:evaluation` |

## Installation — owner executes after review

Review manifest changes, then install from the repository root:

```bash
npm install
```

The owner updates and reviews the root `package-lock.json`. Do not install separately
inside workspaces or delete existing dependencies/lockfiles. After the root lockfile
matches the manifests, use `npm ci` for reproducible checkouts. Gateway and Core build
and development-start scripts build their shared package dependencies first.

## Local development

Copy `.env.example` to `.env` if it does not already exist, then replace the local
credential placeholders. If `.env` exists, merge the six new service database password
variables manually. The root environment file configures Compose only; applications
must eventually receive only their own server-side credentials.

```bash
if [ ! -f .env ]; then (umask 077; cp .env.example .env); fi
# Edit .env: merge missing keys and choose distinct local passwords.
chmod 600 .env
npm run infra:config
npm run infra:check
npm run infra:check:local
docker compose config --quiet
# Owner-run only, after reviewing existing-volume handling:
npm run infra:up
npm run infra:status
npm run infra:verify:postgres
npm run infra:logs
```

`infra:config` validates the example without needing local secrets. To validate your
actual local values, run `docker compose config --quiet`. Infrastructure listens on
loopback, with defaults PostgreSQL `5432`, Redis `6379`, MinIO API `9000`, MinIO
console `9001`. The validated local setup uses PostgreSQL `15432` and Redis `16379`
through `.env` overrides to avoid existing host listeners.
Named volumes persist across `npm run infra:down`; that command does not erase data.
See the component READMEs for credentials, health probes and pgvector verification.
Startup is owner-run. Services share an internal dependency network and a separate
bridge for publishing loopback host ports. The latter permits outbound traffic.
Container restart is manual so initialization failures remain visible. `infra:up`
checks the real `.env` first, including distinct PostgreSQL service/admin passwords.
See the [infrastructure guide](infrastructure/README.md) for runtime validation status.

MinIO is built automatically from pinned official sources by `infra:up`; its former
prebuilt image is unavailable. The first build needs Internet access and can take
several minutes. To build it separately, run `docker compose build minio`.
Go and MinIO do not need to be installed on the host; see the
[storage guide](infrastructure/storage/README.md).

On a fresh PostgreSQL volume, bootstrap prepares six service-owned schemas/logins
and an admin-owned pgvector namespace; it creates no business tables. Existing
volumes are not migrated by a restart or a changed `.env`. In particular, the earlier
`public.vector` setup needs a reviewed migration. See the
[PostgreSQL instructions](infrastructure/postgres/README.md) before using an existing
volume, and the [infrastructure guide](infrastructure/README.md) for exact Redis/MinIO
checks and expected results. The owner validated initialization, schema privilege
boundaries and service authentication on 2026-09-29. Core and Gateway have dedicated
authorization, persistence and integration tests. Shared bootstrap/admin credentials are not for apps.

Start the desired application in a separate terminal with a command from the
workspace table. `npm run dev` starts only Gateway; it does not launch the whole
system. No dependency services are required for the scaffold health routes.

Nest apps use their unique default port and `HOST=127.0.0.1`. To customize, copy that
workspace's `.env.example` to `.env` and edit it. Nest bootstraps load this file from
the workspace directory without overriding exported variables. Gateway consumes `CORE_API_BASE_URL`; other downstream examples remain reserved. Do not copy
root infrastructure credentials into browser variables.

Next.js ports and loopback hosts are explicit in each workspace's `dev` and `start`
scripts. Next.js cannot take its listening port from `.env`; override directly,
for example `npm run dev --workspace=@amani/admin -- --port 3202`. Optional frontend
environment values belong in that workspace's `.env.local`. See the
[Next CLI documentation](https://nextjs.org/docs/app/api-reference/cli/next).

## Health and security principles

All eight Nest services expose `GET /health`, returning HTTP 200 with
`{"status":"ok","service":"@amani/<name>"}`. This is process liveness only; it
makes no claim about database availability, Redis, storage, authorization or
readiness for business traffic. The original `GET /` greeting remains available.
The frontends have starter pages at `/` and no dedicated health route.

Before exposing business endpoints, every Plugin API must authenticate the caller,
verify the user's active membership in the selected organization, verify that the
plugin is enabled and enforce the action's permissions and resource scope. Neither
an organization header nor a trusted network is sufficient authorization. The AI
Orchestrator must retain user and organization context and retrieve only authorized
records, chunks and citations. Worker jobs, caches, object keys and vector searches
must preserve the same isolation. These are required boundaries, not implemented
security controls. See the architecture documentation for the complete model.

Never commit real customer data, local databases, credentials or generated files.
`.gitignore` covers common paths and keeps reviewed `.env.example` templates; it
cannot recognize sensitive data stored under arbitrary source filenames. Review
new files before staging. Use service-scoped credentials and authenticated backend
communication when implementing those clients; the current Compose credentials are
local development bootstrap credentials.

## Validation

Static checks that do not require dependency installation:

```bash
npm run check:structure
npm run infra:config
npm run infra:check
npm run infra:test
```

After the manual installation, validate the actual monorepo dependency resolution:

```bash
npm ls --workspaces --depth=0
npm run lint
npm run typecheck
npm run test:backend
npm run test:e2e
npm run build
npm test
```

Root lint is non-mutating (`lint:check`); original per-backend `lint` scripts still
apply fixes. Root lint/typecheck/build require scripts in every initialized
workspace and never use `--if-present`. Type checks generate Next route types first
and do not emit application builds. Backend unit and HTTP tests run across all
eight Nest services. Gateway HTTP tests include a Core transport simulator; actual
Core/PostgreSQL and Gateway → Core integration have separate opt-in suites documented
in their workspace READMEs. **`npm test` intentionally fails while the three frontends
and type-only packages have no `test` scripts.** Do not interpret passing backend tests
as complete monorepo coverage or add empty success scripts to suppress this gap.

Once dependencies and services are running, inspect Compose status and check the
API liveness routes:

```bash
docker compose ps
for port in 4000 4001 4002 4101 4102 4103 4104 4105; do
  curl --fail --silent --show-error "http://127.0.0.1:$port/health" || exit 1
done
```

## Contribution and commit workflow

Read the relevant component README and architecture decision status before editing.
Follow frontend `AGENTS.md` files and the installed Next.js guides. Preserve service
boundaries, add real tests for behavior changes and document new variables or
ports. New architectural decisions should be recorded as new ADRs without rewriting
historical ones. Keep generated output and local configuration out of commits.

For current changes, inspect
`git status --short` as well as `git diff`: untracked file contents do not appear
in the diff until staged. Group related changes into scoped Conventional Commits.

After reviewing changes, completing manual installation and checking validation:

```bash
git status --short
git diff --check
git diff
# Review untracked files too, then stage only after your approval:
git add .
git diff --cached --check
git diff --cached --stat
git diff --cached
# Confirm ignored local data is absent and the generated root lockfile is included.
git commit -m "type(scope): describe the change"
```

## License

No repository license or rights holder has been selected. Existing NestJS
`UNLICENSED` metadata is preserved and all npm packages are private. No copyright
owner has been invented. The owner must approve the policy and attribution
recorded in [LICENSE-DECISION.md](docs/LICENSE-DECISION.md) before any license text
is added.
