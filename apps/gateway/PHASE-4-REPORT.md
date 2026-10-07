# Phase 4 — API Gateway report

Review date: 2026-10-07 (Africa/Lubumbashi).
Phase 4 is complete for its requested scope: secure Gateway foundations and controlled
local Core integration. All 122 Gateway/Core tests pass, including 33 PostgreSQL
integration cases. Lint, TypeScript, builds and compiled Gateway startup pass.
Production authentication is deliberately not implemented by this phase.

## A. Gateway audit summary

The audit covered all ADRs 0001–0030 (unchanged from the Core audit), architecture
README and authorization constraints, the diagram catalog and relevant diagrams
02/04/06/07/09/15/16, the actual Core controllers/policy/configuration/tests, all four
shared packages, both workspace manifests, root configuration and environment examples.
Core code, rather than stale scaffold documentation, determined the routed contracts.

Accepted ADRs 0003/0004/0010/0012/0015 establish Gateway/Core ownership, tenant isolation,
Core policy and plugin lifecycle. Proposed ADRs 0005/0007/0011 leave production identity,
service credentials, delegation transport and API versioning open. No accepted decision
selects an IAM vendor or permits identity headers/network location as authentication.
No accepted-ADR conflict was found. Stale implementation-status prose was corrected;
no ADR history or diagram was rewritten.

## B. Files created

Under `apps/gateway/`:

```text
PHASE-4-REPORT.md
src/auth/authentication.ts
src/auth/guards.ts
src/common/context.ts
src/common/errors.ts
src/common/http.ts
src/common/logging.ts
src/common/rate-limit.ts
src/config/gateway.config.ts
src/config/gateway.config.spec.ts
src/core-client/core-client.ts
src/core-client/responses.ts
src/core-client/service-authentication.ts
src/routing/platform.controller.ts
test/helpers.ts
test/core.integration-spec.ts
test/jest-integration.json
```

Core support files:

```text
apps/core-api/src/common/development-identity.ts
apps/core-api/src/common/development-identity.spec.ts
apps/core-api/test/gateway-fixture.ts
```

The Core files are necessary to exercise the real interservice boundary. The fixture
is test-only, owns Core data setup, and is excluded from the production build.

## C. Files modified

- Gateway: `.env.example`, `README.md`, `package.json`, `tsconfig.json`,
  `tsconfig.build.json`, `src/app.module.ts`, `src/main.ts`, `src/app.controller.ts`,
  `src/app.controller.spec.ts`, `test/app.e2e-spec.ts`.
- Core: `.env.example`, `README.md`, `src/app.module.ts`, `src/main.ts`,
  `src/common/context.ts`, `src/authorization/authorization.service.ts`.
- Shared: `packages/contracts/src/index.ts`, `packages/contracts/README.md`.
- Repository: `README.md`, `docs/architecture/README.md`,
  `docs/architecture/authorization.md`, `scripts/check-structure.mjs`.
- `package-lock.json`: updated by the owner's `npm install`; seven Gateway dependency
  entries added, preserving the existing resolved dependency graph.

The structure check now recognizes Gateway's explicit `GATEWAY_PORT`. No infrastructure,
Plugin API, worker, Orchestrator or frontend business code changed. Initial implementation
involved no git staging, commit, push, dependency cleanup or lockfile deletion.
The owner subsequently authorized local commits on 2026-10-07.

## D. Final Gateway module structure

Nest's composition root wires `auth`, `common`, `config`, `core-client` and `routing`.
Global authentication/authorization guards protect registered routes by default.
AppController contains liveness/readiness; PlatformController contains explicit
platform routes. There is no generic proxy, database module or unused placeholder module.
The [README](README.md#structure-and-flow) contains the tree and request-flow diagram.

## E. Authentication boundary implemented

`AuthenticationProvider` defaults closed. An optional opaque development bearer maps
to one server-configured existing synthetic user. Production/staging rejects this mode;
explicit development/test NODE_ENV and loopback endpoints are required. No passwords,
login pages, sessions, OAuth/OIDC provider or token issuer was implemented.

`ServiceAuthentication` also defaults closed. The optional local HMAC adapter is
verified independently by Core, with operation/audience/request/body binding, a
maximum 30-second lifetime and replay rejection. It uses a separate random secret.
Both ports can be replaced after production authentication decisions are accepted.

## F. Request context strategy

Fresh server-generated request ID; validated incoming correlation ID or generated
root ID; service name, UTC timestamp, verified `AuthenticatedPrincipal`; optional
organization selected from the validated URL. `ApiMetadata`, `ErrorEnvelope` and
shared ID helpers are reused. Tracing and tenant selection never grant permission.

## G. Core API client design

One native-fetch client owns URL construction, serialization, timeouts, bounded JSON
reading, service proof headers, safe transport logs, error mapping and public response
projection. No incoming header collection is forwarded. Shared contracts describe
transport data only; Gateway imports no Core application source or ORM model.

## H. Authorization flow

URL validation → verified principal → explicit permission metadata → actual Core
policy call → strict matching decision → authorized-organization limiter → business
call → Core reauthorization. No role resolution or entitlement implementation exists
in Gateway. Missing permission metadata denies new protected routes, except the
explicit self/onboarding routes. No permission cache or privileged tenant fallback exists.

## I. Internal header security strategy

Reserved user/tenant/roles/permissions/service/delegation/proxy headers are stripped.
Outbound application headers are only Accept, optional Content-Type, tracing IDs and
new service-authentication proof. External bearer credentials and cookies are never
forwarded. Spoofed organization headers cannot alter the URL-selected organization.

## J. Routing architecture

Seven controlled route definitions under `/api/platform`: current user, organization
creation/read, membership creation/read, effective permissions and plugin access.
Only `/`, `/health`, `/ready` are public. No platform-admin/user-creation endpoints,
catch-all proxy or unavailable Plugin/AI routes are exposed. See the README route table.

## K. CORS configuration

Exact origin allowlist from environment, development ports 3000–3002, GET/POST and
explicit headers. No credentialed wildcard or cookie authentication. Bad origins and
preflights receive 403. Production requires explicit HTTPS origins. Quota responses
retain CORS headers for allowed origins.

## L. Rate limiting configuration

Per-process fixed windows: IP 120/min, authenticated user 120/min, authorized organization
600/min by default. Limits/window/cardinality are configurable, with a 10,000-key cap
and Retry-After. Proxy IP headers are ignored; denied outsiders do not spend an
organization quota. An endpoint-class dimension is available; current routes use `all`.
Distributed Redis counters and production quotas are deferred.

## M. Timeout / resilience strategy

Default 3-second deadline covers both headers and body. Core responses are bounded to
256 KiB, request JSON to 64 KiB by default. No redirects or automatic retries, including
non-idempotent POSTs. A timed-out write may still have committed and must be reconciled
before a manual retry. Readiness probes actual Core database readiness and requires
both auth providers configured; it is not a credential-handshake or production-readiness claim.

## N. Error mapping

Fixed public error envelopes: 400 validation, 401 unauthenticated, 403 forbidden,
404 absent scoped object, 409 conflict, 413 excess body, 415 unsupported media, 429 limit,
502 invalid/unexpected Core response or Core 500, 503 missing service credentials or
connection failure, 504 deadline, 500 unexpected Gateway failure. Core private text,
SQL, stacks, URLs and response cookies never reach callers.

## O. Logging strategy

JSON metadata only: service, environment, request/correlation IDs, bounded method,
registered route template, HTTP status and duration. Core transport logs use fixed
operation names. No user/organization IDs, incoming URL/query, payload, token, cookie,
service proof or raw exception is logged. No collector deployment is added.

## P. Tests added

- Gateway: 19 unit tests, 41 HTTP tests; configuration and production exclusion,
  credential matching, quota bounds/expiry, health/readiness, tracing, spoofing,
  permission denial/mismatch, response projection, Core 400/403/404/409/429/500/503/504,
  connection failure, slow headers/body, redirects, malformed/oversized responses,
  input validation, CORS, HSTS, quotas, safe logs and no POST retry.
- Core: 14 additional verifier tests (20 unit tests total), plus 9 retained HTTP
  regressions; default denial, valid signatures, tampering, expiry, audience/scope,
  replay and production exclusion.
- Gateway actual Core integration: 11 cases through real HTTP and PostgreSQL, with
  Core-owned transactional synthetic fixtures. Tests cover owner/read permissions,
  nonmember/inactive/no-role/platform-admin denial, wrong tenant, active/disabled
  plugin control-plane state, membership and organization writes, conflicts and
  incorrect service credentials. No Core ORM import in Gateway tests.
- Core retains 22 PostgreSQL integration regressions from phase 3.

## Q. Validation actually executed

| Check | Result |
| --- | --- |
| Gateway lint / TypeScript | PASS |
| Gateway unit tests | PASS — 19 |
| Gateway HTTP e2e tests | PASS — 41 |
| Core lint / TypeScript | PASS |
| Core unit tests | PASS — 20 |
| Core HTTP e2e tests | PASS — 9 |
| Core PostgreSQL integration regressions | PASS — 22 |
| Contracts lint / typecheck / compile-time tests | PASS |
| Builds of all four shared packages, Core and Gateway | PASS |
| Compiled Gateway startup and HTTP smoke | PASS — health 200, tracing/security headers, forged request 401, unconfigured readiness 503 |
| Structure check / `git diff --check` | PASS |
| `npm ls --workspace=@amani/gateway --depth=0` | PASS — required dependencies resolve; pre-existing extraneous packages untouched |
| Owner-updated root lockfile matches Gateway dependencies | PASS |
| Gateway real-Core PostgreSQL integration | PASS — 11 cases through real HTTP, signing, Core verification/policy and PostgreSQL |
| Authorized restart of existing Compose containers | PASS — PostgreSQL, Redis and MinIO healthy; no rebuild or volume changes |
| Persistent fixture rollback check | PASS — user, organization, membership and audit counts match the original baseline (all zero) |

The compiled smoke and Core fixture processes were stopped afterward. Existing
containers were restarted with explicit owner authorization and left running. An
initial stopped-container failure and uppercase fixture-email constraint failure were
resolved before the successful integration run. No production deployment was attempted.

## R. Validation not executed and why

- Production authentication/TLS/IAM, distributed quotas and Plugin/AI integrations:
  NOT RUN, unimplemented and outside this phase.
- Whole-monorepo tests/builds: NOT RUN for unaffected applications. The structure check
  still identifies frontends and type-only packages without a `test` script; root
  `npm test` is not a valid all-green gate for this repository yet.
- Destructive cleanup, container rebuild, volume reset, remote push: NOT RUN.

## S. New dependencies

Gateway now declares `@amani/types`, `@amani/contracts`, `@amani/config`, `@amani/shared`
(all 0.1.0), `class-validator` 0.15.1, `class-transformer` 0.5.1 and direct `express` 5.2.1.
These were already present in the installed monorepo/Nest/Core stack. No new HTTP,
Redis, ORM, JWT or IAM library was introduced. Owner installation and lock update
are complete. Do not delete dependencies or lockfiles.

## T. Exact manual commands

Installation has already been performed. If the existing containers are stopped,
the owner can restart them without building or pulling images:

```bash
cd /home/andrix-ng/Bureau/amani.ia
docker compose start --wait
npm run infra:status
GATEWAY_CORE_TESTS=true npm run test:integration --workspace=@amani/gateway
CORE_DB_TESTS=true npm run test:integration --workspace=@amani/core-api
```

To reproduce standalone validation and start the services:

```bash
npm run lint:check --workspace=@amani/gateway --workspace=@amani/core-api
npm run typecheck --workspace=@amani/gateway --workspace=@amani/core-api
npm test --workspace=@amani/gateway --workspace=@amani/core-api -- --runInBand
npm run test:e2e --workspace=@amani/gateway --workspace=@amani/core-api -- --runInBand
npm run build --workspace=@amani/core-api --workspace=@amani/gateway
test -f apps/gateway/.env || cp apps/gateway/.env.example apps/gateway/.env
chmod 600 apps/gateway/.env
npm run dev:core
# In a second terminal at the repository root:
npm run dev:gateway
# In a third terminal:
curl --fail http://127.0.0.1:4000/health
```

Default protected requests return 401. Optional local credentials and their provenance
are documented in [README.md](README.md#development-authentication). The transactional
integration suite is the reproducible authenticated demo; normal Core seed creates no
user, and no arbitrary UUID will create a valid identity. Do not copy database/admin
credentials into Gateway. These setup and validation commands do not stage or commit files.

## U. ADR conflicts or missing architecture decisions

No accepted boundary was silently redesigned. NextAuth in a diagram is illustrative,
not accepted IAM selection. Production user/session mechanism, service credentials,
bounded delegation lifecycle, rotation/revocation, TLS ingress, proxy trust, production
CORS/quotas, OpenAPI/versioning and initial identity/admin provisioning remain decisions.
Core's existing Drizzle choice remains internal to Core. The local HMAC adapter is
explicitly not an accepted production protocol. Shared packages contain only wire types.

## V. Remaining work before Knowledge Plugin development

Review phase 4 and its documented production limits. Select or explicitly
stage the remaining production authentication/contract decisions before real customer
traffic. The future Knowledge phase must define and enforce document/source ACLs,
upload/storage scope, retention and authenticated plugin calls with cross-tenant negative
tests. No Knowledge, worker, Orchestrator or frontend implementation was started here.

## W. Proposed Conventional Commit

```text
feat(gateway): secure platform routing and Core authorization integration
```

This message was proposed at implementation handoff. The owner subsequently authorized
separate local commits for contracts, Core support and Gateway. No remote push was requested.
