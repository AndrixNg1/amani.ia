# Core Platform API — Phase 3

Core persists platform identities, organizations, memberships, teams, tenant roles,
permissions, the plugin registry, installations, plans, entitlements and audit records.
It exposes policy decisions for future authenticated callers. Documents, datasets,
conversations, connectors, evaluations and their resource ACLs belong to Plugin APIs.

**Production authentication is not implemented.** The default `IdentityVerifier` returns
no identity, so business HTTP endpoints return **403**, including internal routes.
Only `/`, `/health` and `/health/ready` are public. Phase 4 adds an explicit local-only
service/delegation verifier for Gateway integration; membership and policy checks
remain in Core. It does not enable arbitrary identity headers or select production IAM.

For local integration only, set `NODE_ENV=development`, `APP_ENV=development`,
`CORE_SERVICE_AUTH_MODE=development` and a random 64-hex `DEVELOPMENT_SERVICE_SECRET`
matching Gateway's separate service secret. Keep `HOST=127.0.0.1`. The factory rejects
production/staging, absent explicit NODE_ENV, weak/invalid keys and external listeners.
Default `CORE_SERVICE_AUTH_MODE=disabled` remains closed. Gateway's bearer token is
never a Core credential. The main HTTP bootstrap captures raw JSON bytes so the verifier
can bind signatures to the exact body, method, URL, scope, audience and tracing IDs.
Delegations expire within 30 seconds and a bounded nonce cache rejects replay.
See [Gateway's protocol and setup](../gateway/README.md) for the full development boundary.

The Core-owned `test/gateway-fixture.ts` creates synthetic transactional fixtures and
serves the real signed HTTP boundary for Gateway tests. It rolls back all data on exit.
Existing phase-3 domain tests retain their separate test-container verifier override.

## Architecture audit and choice

The audit covered all ADRs 0001–0030, architecture README/authorization documentation,
the diagram catalog and diagrams 02, 04, 06, 07, 09, 15 and 16, the four shared packages,
Core's starter, PostgreSQL ownership scripts, root configuration and workspace scripts.
The existing Core had only its starter and liveness route; no ORM had been selected.
Some architecture status sections predate phases 1–3. Diagram illustrations of
NextAuth, marketplace packages, resource permissions in Core, or one role per user
are not authoritative decisions; the ADRs and diagram catalog explicitly govern them.

**Selected: Drizzle ORM 0.45.3 with node-postgres 8.23.0.** Typed internal table models,
parameterized queries and transactions fit the existing service-owned PostgreSQL
schema without code generation or Nest ORM decorators. Reviewed SQL migrations make
composite tenant foreign keys visible. No Prisma, TypeORM, schema synchronization,
`drizzle-kit push`, schema-per-tenant or cross-service ORM models are introduced.
See the official [PostgreSQL integration](https://orm.drizzle.team/docs/get-started-postgresql)
and [transactions](https://orm.drizzle.team/docs/transactions) documentation.

This resolves an open choice in ADR-0008/0030. A follow-up ADR recording this **Core-only**
ORM/migration choice should be proposed; it does not choose an ORM for other services.
No conflict with the accepted ADRs was found. No infrastructure changes are needed.

## Module structure

```text
src/
  common/          configuration, validated DTOs, tracing, HTTP errors, trust boundary
  database/        internal Drizzle models, connection, migration runner, explicit seed
  users/           global identities; no authentication credentials
  organizations/   atomic owner onboarding and organization metadata
  memberships/     active/inactive organization membership
  teams/           organization teams and membership links
  roles/           system/custom roles, permission and membership assignments
  permissions/     extensible canonical tenant permission catalog
  plugins/         registry, versions, organization installation lifecycle
  plans/           plan catalog and trusted subscription assignment
  entitlements/    capability checks from active subscriptions
  authorization/   effective permissions, deny-by-default policy, internal endpoints
  audit/           transactional sensitive-operation records
  health/          PostgreSQL readiness
  app.module.ts    composition root, controllers and global guard
migrations/        checked-in SQL owned by Core
scripts/           safe local environment preparation
test/             HTTP boundary and real PostgreSQL integration suites
```

The dependency graph points toward Database and Authorization, then Audit; domain
modules do not import each other cyclically. HTTP controllers are registered at the
composition root. Shared packages provide configuration parsing (`@amani/config`),
tracing (`@amani/shared`), branded IDs (`@amani/types`), and scope, health and error
contracts (`@amani/contracts`). ORM models and Core policy response types remain local.

## Database ownership and model

Login is fixed to **amani_core_platform**, schema to **core_platform**. Applications
cannot select the bootstrap superuser through a database URL or `DB_USER`. The service
has no connection to Redis, MinIO or another service schema. UUID defaults use native
PostgreSQL `gen_random_uuid()`; Core does not use pgvector or install extensions.

The initial migration creates 18 business tables plus its migration ledger:

| Tables | Relationship and purpose |
| --- | --- |
| `users`, `organizations` | Global identity; organization is tenant boundary |
| `memberships` | User belongs to multiple organizations; unique organization/user |
| `teams`, `team_memberships` | Team membership within the same organization |
| `roles`, `permissions` | Tenant roles; canonical, extensible permission definitions |
| `role_permissions`, `membership_roles` | Multiple roles per membership; multiple permissions per role |
| `platform_roles`, `user_platform_roles` | Separate platform admin/moderator assignments |
| `plugins`, `plugin_versions` | Platform catalog and API compatibility version |
| `organization_plugin_installations` | One installation per organization/plugin; version belongs to plugin |
| `plans`, `plan_entitlements` | Capabilities such as `plugin:knowledge`; no prices or payment |
| `organization_subscriptions` | One current subscription per organization; optional validity period |
| `audit_events` | Actor, tenant, action, target, correlation, outcome, allowlisted metadata |
| `schema_migrations` | Applied filename, SHA-256 checksum and timestamp |

Composite foreign keys bind role, membership and team references to the same
organization even for direct SQL inserts. Email is normalized to lowercase and unique;
organization slugs, canonical permission keys and plugin keys are unique. Status checks,
foreign keys and indexes enforce the persistence boundary. There are no cross-schema
foreign keys. `schema.ts` defines internal query mappings; SQL is authoritative for
constraints and indexes. Future schema changes must update both and add a migration.

No RLS is introduced: ADR-0010 leaves it optional. No resource ACL tables are placed
in Core. Production should split migration ownership from runtime privileges; the
existing development role owns its own schema and can therefore alter its tables.

## Configuration and local commands

Execute from the repository root. Dependency installation is reserved to the owner;
it was reported completed during this phase. Run it again only if manifests changed
since that installation. Keep the root lockfile produced by npm; do not remove it.

```bash
cd /home/andrix-ng/Bureau/amani.ia
npm install
npm run build --workspace=@amani/types --workspace=@amani/contracts --workspace=@amani/config --workspace=@amani/shared
npm run env:local --workspace=@amani/core-api
```

`env:local` reads the root `.env` with Node's parser, copies only PostgreSQL host,
port, database and **CORE_PLATFORM_DB_PASSWORD**, and adds missing keys to the Core
`.env`. Existing values are preserved, secrets are never printed, and file mode is
600. If an existing Core value is wrong, correct it manually. Root `.env` is not
implicitly loaded by normal application startup. Core build and development-start hooks also build the four shared packages first,
so a fresh checkout does not depend on pre-existing package artifacts. npm workspace commands run inside
`apps/core-api`; Node loads that directory's optional `.env`, preserving shell overrides.

| Variable | Source / behavior |
| --- | --- |
| `APP_ENV` | `development` by default; development/test/staging/production |
| `HOST`, `PORT` | `127.0.0.1`, `4001`; bounded port validation |
| `DB_HOST` | Root `POSTGRES_HOST`, normally `127.0.0.1` on the host |
| `DB_PORT` | Root `POSTGRES_PORT`; **15432 on this PC**, Compose default 5432 |
| `DB_NAME` | Root `POSTGRES_DB`, currently `amani` |
| `CORE_PLATFORM_DB_PASSWORD` | Existing matching service password from root `.env` |
| `DB_SSL` | False for local development; verified TLS required in staging/production |
| `DB_POOL_SIZE` | Default 10, allowed 1–30 |
| `CORE_DB_TESTS` | Explicit `true` opt-in for the integration test command only |

Service name is fixed to `@amani/core-api`. Logging uses Nest startup/warning messages
and fixed connection-failure messages; no SQL query, parameter, body, token, password
or connection URL is logged. There is no tracing backend or log collector yet.
Connections have 3-second connect/lock timeouts and a 5-second statement timeout.

Start the existing infrastructure manually if it is stopped, then apply Core migrations:

```bash
npm run infra:up -- --no-build --pull never
npm run infra:status
npm run db:migrate --workspace=@amani/core-api
# Optional, explicit DEVELOPMENT data only:
npm run db:seed --workspace=@amani/core-api
npm run dev:core
```

If the local infrastructure images do not already exist, use the documented phase 2
build/start procedure instead of `--no-build --pull never`.

In another terminal:

```bash
curl --fail http://127.0.0.1:4001/health
curl --fail http://127.0.0.1:4001/health/ready
```

`/health` is process liveness and works with a valid configuration even if PostgreSQL
is unavailable. `/health/ready` actually queries PostgreSQL, verifies the service role
and schema, and checks that the organization table is accessible. A failure returns
503 without driver details. It does not claim readiness of authentication, Redis,
MinIO, plugins, or the entire Amani project.

## Migrations and seed

`db:migrate` runs the ordered checked-in migration list in **one transaction**, using
an advisory transaction lock to serialize concurrent migration runners. It verifies
service identity, records SHA-256 checksums, skips identical applied files, and refuses
a changed applied migration. It never creates the service schema, changes another
service's objects, synchronizes models automatically, or runs during API startup.

The initial migration installs canonical Core permissions and the two platform role
**definitions**, but assigns no platform role to a user. Onboarding therefore works
without the development seed once an identity has been legitimately provisioned.

`db:seed` is explicit, additive and restricted to development/test. It prepares the
five official catalog entries, version `0.1.0-dev` / API `1`, five illustrative plugin
permission definitions and a synthetic `development-all` plan with plugin entitlements.
These versions are development metadata, not evidence of deployed plugin functionality.
No users, organizations, real subscriptions, installations or platform administrators
are created. Replaying the seed does not reactivate disabled entries or reset grants.

There is deliberately no destructive down/reset command. Future reversals require a
reviewed corrective migration and backup/recovery plan. Do not edit applied SQL files.
Package the checked-in migrations alongside the service when deployment is added.

## Organization creation, roles and tenant isolation

Creation requires an active verified user. One transaction creates the organization,
owner membership, `owner`/`admin`/`member` system roles, explicit baseline grants, owner
assignment and audit event. The actor becomes owner; the request cannot choose another
user. Any failure, including audit failure, rolls everything back.

Owner and admin baseline permissions are:
`organization.read`, `organization.manage`, `members.read`, `members.manage`,
`teams.read`, `teams.manage`, `roles.read`, `roles.manage`, `plugins.use`,
`plugins.manage`, `audit.read`. Member baseline is `organization.read`, `teams.read`,
`plugins.use`. New memberships have **no assigned role** until explicitly granted one.
Teams group members; they do not implicitly grant or inherit permissions.

System role definitions cannot be edited. Owner assignment/removal and owner membership
deactivation are refused by ordinary role/member operations. Ownership transfer is a
separate future workflow; this protects the initial owner from being removed by an
admin. Custom organization roles are supported. An owner can delegate canonical tenant
permissions to custom roles; other role managers can only grant/assign permissions
they currently hold. Only an owner can assign the system admin role. There are no
wildcards or automatic grants when new catalog permissions appear.

An owner has no automatic plugin resource permission: explicitly assign a suitable
custom role, and the plugin must still check resource ACLs. Organization owners/admins
never acquire platform roles. `platform_admin` can provision identities and execute
trusted control-plane subscription/provisioning commands; it does not confer tenant
membership or data read access. `platform_moderator` is modeled with **no authority
implemented yet**. No HTTP route bootstraps or assigns platform roles.

Every tenant lookup/mutation carries organization context and queries by organization
plus object ID. Domain services compare the actor's tenant with the requested tenant.
Tenant mutations lock the organization row, then recheck current authorization inside
the same transaction, preventing competing tenant mutations from interleaving policy
changes. Composite keys provide another check against cross-tenant object references.
No policy cache is introduced; inactive users, memberships and organizations deny access.

## Authorization and plugin lifecycle

`AuthorizationService.check` returns an explicit decision with `allowed`, `userId`,
`organizationId`, `permission` and one of `ROLE_PERMISSION`, `INACTIVE_CONTEXT`,
`MISSING_PERMISSION`, `WRONG_ORGANIZATION`, `PLUGIN_UNAVAILABLE`.

Effective permission resolution unions the membership's roles in the selected tenant.
Plugin-specific permissions additionally require `plugins.use`, an available catalog
entry, an active installation, an active plan, an enabled matching capability and a
currently valid active/trial subscription. `past_due`, suspended, cancelled, expired,
future subscriptions and disabled plans deny entitlement; there is no invented grace
period. A `plugins.use` authorization check must name the target plugin.
The generic `plugins.use` entry in the effective permission list is a capability,
not an authorization to use any unspecified plugin.

The exact ADR lifecycle is `requested → provisioning → active`, with explicit paths
through `suspended`, `disabled`, `deprovisioning` and retryable `failed`. `available`
is a catalog state, not an installation state. No `pending` synonym is introduced.
Installation requests are idempotent for the same version; retrying a disabled
installation does not reactivate it. Different versions require a future upgrade flow.
Tenant HTTP callers can request, suspend or disable; progression through provisioning
and activation requires the trusted platform-admin service method. This records
**control-plane state only**: there is no job, deployment or plugin-data provisioning.
Future provisioning code must verify completion before advancing state. Deactivation
revokes access and never deletes plugin-owned customer data.

`plans`, `plan_entitlements`, and the one current subscription per organization form
an entitlement foundation. Trusted `PlansService.setSubscription` requires platform
administration and an explicit tenant context. No tenant HTTP route selects a paid
plan, and no billing provider or subscription history engine is implemented.

## HTTP API foundation

All business routes below require a future verified caller. Arbitrary `userId`,
`organizationId`, service-name and bearer headers cannot establish identity. The
verification adapter must validate service/delegation signatures, issuer, audience,
expiry and bounded scope before returning `VerifiedIdentity`. The global guard checks
audience, expiry, operation, resource type, tenant and any resource/plugin restriction.
The domain layer independently rechecks database membership and permissions.
Non-tenant actions (identity provisioning and organization creation) have explicitly
separate operation scopes; they are not fabricated tenant-wide grants.

| Routes | Foundation |
| --- | --- |
| `POST /users`, `GET /users/:id`, `PATCH /users/me` | Platform-provisioned identity, self/platform read, self display name |
| `POST /organizations`, `GET/PATCH /organizations/:organizationId` | Atomic creation, authorized read/name update |
| `POST /organizations/:organizationId/memberships` | Add existing active user; no invitation mail |
| `GET .../memberships/by-user/:id`, `PATCH .../memberships/:id` | Scoped lookup and membership status |
| `GET/POST .../teams`, `POST .../teams/:id/members`, `DELETE .../teams/:id/members/:membershipId` | Teams and scoped membership links |
| `GET/POST .../roles`, `POST/DELETE .../roles/:id/permissions` | Custom roles and canonical permission assignment |
| `POST .../memberships/:id/roles`, `DELETE .../memberships/:id/roles/:roleId` | Multiple role assignment/revocation |
| `GET /plugins/:pluginKey`, `POST .../plugins`, `GET/PATCH .../plugins/:id` | Catalog, request, installation state |
| `GET /plans`, `GET .../permissions`, `GET .../audit` | Metadata and bounded organization audit reads |
| `POST /internal/authorization/check` | `{organizationId, permission, pluginKey?}` for the verified user |
| `GET /internal/authorization/effective-permissions?organizationId=...` | Current effective permissions for verified user |
| `GET /internal/plugins/:pluginKey/access?organizationId=...` | Current user/plugin access decision |
| `GET /internal/organizations/:organizationId/memberships/:id` | Membership of user `:id`, requiring `members.read` |

`...` abbreviates `/organizations/:organizationId`. The team removal route is exactly
`DELETE /organizations/:organizationId/teams/:id/members/:membershipId`.
Internal policy bodies cannot supply a different user identity. A policy allow only
covers organization/plugin capability; it is **not** a document or dataset ACL result.

DTOs reject unknown fields, malformed UUIDs, invalid states and unbounded strings.
Errors use the shared `{error: {code, message}, meta}` envelope: 400 validation,
403 denial, 404 missing scoped object, 409 conflicts, 503 unavailable dependency,
500 unexpected failure. Driver errors, SQL parameters and stacks are not returned.
Public denials are deliberately generic; internal policy decisions are explicit.
Tracing IDs are bounded and propagated/generated through shared helpers, never used
as authentication. Successful responses are Core DTOs/data projections, not live ORM
objects with relations or connection details. Lists are bounded (100, permissions
200); continuation pagination and public OpenAPI contracts remain future work.

## Audit

Sensitive successful changes write their audit event inside the same transaction as
the mutation: organizations, identities, memberships, custom roles, permission/role
assignments, team membership, installations and subscriptions. Fields include actor,
optional tenant, action, target type/id, outcome, correlation and timestamp.
Only role ID, permission key, status and plugin key are allowed in metadata; descriptions,
request bodies, emails, secrets, tokens and plugin content are excluded.

No update/delete audit API exists. This is not tamper-proof storage: the development
schema owner can still change its tables. Dedicated runtime grants, append-only
storage controls, retention, failed-operation audit and support/moderation workflows
are future work. Audit reads require `audit.read` in the selected organization.

## Validation

```bash
npm run lint:check --workspace=@amani/core-api
npm run typecheck --workspace=@amani/core-api
npm run test --workspace=@amani/core-api -- --runInBand
npm run test:e2e --workspace=@amani/core-api -- --runInBand
CORE_DB_TESTS=true npm run test:integration --workspace=@amani/core-api
npm run build --workspace=@amani/core-api
```

The integration suite connects with the actual Core service credentials. It checks
migrations, seeds, constraints, onboarding rollback, permission changes, inactive
contexts, platform separation, cross-tenant roles/teams/installations, entitlements,
lifecycle transitions, audit and validated HTTP calls using a test-only verifier.
One outer transaction contains migrations (if absent) and synthetic fixtures; all
service transactions become real PostgreSQL savepoints. Teardown **rolls everything
back**, including newly created tables. Existing business rows are not permanently changed, deleted or
reset. Tests are serial and refuse to silently skip when credentials or opt-in are
missing. Use a dedicated development database/instance if running alongside other
work, because migration tests hold an advisory lock for the suite's duration.

The HTTP suite separately proves that the real default verifier denies forged headers
and that liveness survives a database outage. Unit tests cover configuration boundaries
and valid/invalid lifecycle transitions. See `PHASE-3-REPORT.md` for the actually
executed checks and remaining runtime work; a successful liveness request alone does
not demonstrate authorization or persistence correctness.

## Remaining before production Gateway traffic

Select and implement production user/service authentication, credential rotation and
revocation, secure initial identity/admin provisioning and production transport/TLS.
Local bounded delegation and the Gateway client now exist in phase 4. OpenAPI/versioned
transport documentation, pagination, deployment packaging and separate production
runtime grants remain open. Keep resource ACLs in the future Plugin APIs. Ownership
transfer, invitation acceptance, provisioning jobs, billing, resource data, RLS,
telemetry backends and UI remain outside these phases.

The historical phase-3 report describes its original validation. Current phase-4
changes and executed checks are recorded in [the Gateway report](../gateway/PHASE-4-REPORT.md).
