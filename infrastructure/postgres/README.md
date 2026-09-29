# PostgreSQL and pgvector

Status: owner-run recovery and verification passed on 2026-09-29: pgvector 0.8.6,
six owned schemas, catalog privilege/default-grant checks, and six TCP login and
wrong-password rejection checks. The validated local host port is 15432. Persistence
and business/tenant query tests remain **NOT RUN**. No business tables, migrations,
RAG or application client are added.

## VS Code SQL dialect

These scripts use PostgreSQL and psql commands such as `\set`, `\getenv` and `\ir`.
Diagnostics owned by `mssql` (for example, "Incorrect syntax near '\\'") come from
the SQL Server/T-SQL analyzer and do not validate these PostgreSQL scripts.

For this PostgreSQL workspace, set the following in local `.vscode/settings.json`
(the repository ignores this editor directory):

```json
{
  "mssql.intelliSense.enableIntelliSense": false
}
```

Reload VS Code with **Developer: Reload Window** if old diagnostics remain. This
disables only MSSQL IntelliSense in this workspace; use a PostgreSQL connection
in SQLTools for ordinary queries. Run bootstrap/verification scripts through the
documented entrypoint and npm commands, because psql meta-commands are not ordinary
SQL queries. This editor setting is not evidence of successful SQL execution.
See [MSSQL configuration](https://github.com/microsoft/vscode-mssql) and
[VS Code workspace settings](https://code.visualstudio.com/docs/configure/settings).

## Database and ownership

One PostgreSQL 17 server and one configurable database (`POSTGRES_DB=amani`) support
local development. The admin `POSTGRES_USER=amani` owns the database and extension;
applications must never use its credential. Fixed schema/login names keep ownership
explicit and avoid accidental cross-service reassignment.

| Owning service | Schema | Login | Password variable |
| --- | --- | --- | --- |
| Core Platform | `core_platform` | `amani_core_platform` | `CORE_PLATFORM_DB_PASSWORD` |
| Knowledge | `knowledge` | `amani_knowledge` | `KNOWLEDGE_DB_PASSWORD` |
| Data Analytics | `data_analytics` | `amani_data_analytics` | `DATA_ANALYTICS_DB_PASSWORD` |
| Conversations | `conversations` | `amani_conversations` | `CONVERSATIONS_DB_PASSWORD` |
| Connectors | `connectors` | `amani_connectors` | `CONNECTORS_DB_PASSWORD` |
| Evaluation | `evaluation` | `amani_evaluation` | `EVALUATION_DB_PASSWORD` |

Gateway and AI Orchestrator get no SQL login/schema. `extensions` is an additional
admin-owned infrastructure namespace, not a seventh business owner.

Each service role has LOGIN, but no SUPERUSER, CREATEDB, CREATEROLE, REPLICATION,
BYPASSRLS or role membership. It owns only its matching schema and receives CONNECT
to `amani`, without database CREATE or TEMPORARY. PUBLIC access to the database,
`public` schema, `postgres` and `template1` databases is revoked. Schema grants to
other services are rejected by bootstrap checks. Catalog metadata is not hidden;
this is logical data isolation, not concealment of service names.

Future migrations must execute as their service role and qualify the owning schema;
no cross-service joins, foreign keys or direct table access. Role-specific
`search_path` chooses the service schema; PostgreSQL implicitly searches `pg_catalog`
first. Knowledge additionally resolves `extensions`. The administrator defaults to
`pg_catalog`, excluding writable application schemas.

Global per-creator defaults revoke PUBLIC table/sequence rights, function EXECUTE
and type USAGE. Per-schema revocation alone cannot undo PostgreSQL's global PUBLIC
function/type defaults. These defaults affect future objects made by that role,
not objects made by an administrator or pre-existing grants.
See [PostgreSQL schemas](https://www.postgresql.org/docs/17/ddl-schemas.html) and
[default privileges](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).

The local role combines schema owner and migration/runtime access for this foundation.
It can change its own objects/grants; this is not a hostile-code sandbox. Future
production setup should separate migration owners from restricted runtime roles.
`NOBYPASSRLS` alone does not enforce tenant isolation, and table owners normally bypass
RLS unless separately forced. Tenant columns, guards and policies remain unimplemented.

## Configuration and initialization

Compose uses `pgvector/pgvector:0.8.6-pg17-bookworm`, loopback host port 5432,
`postgres_data:/var/lib/postgresql/data` and a read-only init-directory mount.
`POSTGRES_PORT` changes the host port; `POSTGRES_HOST` is a connection hint only.
All seven PostgreSQL passwords must be nonempty and distinct. `infra:check:local`
checks this before `infra:up` starts Docker, without displaying the values. Admin/database names
must be simple SQL identifiers (letters/digits/underscore, max 63, not starting
with a digit); reserve `postgres`, `template0`, `template1` for administration.

Initialization on a **fresh volume** runs in filename order:

1. [001-vector.sql](init/001-vector.sql) creates admin-owned `extensions`, installs
   `vector`, rejects an unexpected pre-existing location/owner, and removes PUBLIC
   access to the namespace, extension functions and vector types.
2. [002-service-isolation.sh](init/002-service-isolation.sh) validates required
   environment and invokes [bootstrap.sql](init/sql/bootstrap.sql) in one transaction.
   Its [service.sql](init/sql/service.sql) helper creates roles/schemas if absent,
   refuses a foreign schema owner, sets defaults, and grants Knowledge access to the
   extension. Nested SQL helpers are not executed independently by the entrypoint.

Role passwords are read with psql `\getenv`, quoted as SQL literals and identifiers,
not passed through argv or shell `eval`. SQL echo/statement logging is disabled in
that bootstrap session, and failures produce a generic message without the SQL or
secret value. Do not enable shell tracing/SQL echo to debug credentials. Existing
role passwords are preserved during an explicit reviewed replay; `.env` is not a
password-rotation mechanism.

Fresh init uses `--auth-host=scram-sha-256` and host-auth SCRAM, including TCP loopback.
Local Unix socket access inside the administrative container is still trusted for
bootstrap. Host/Docker administrative access remains privileged.

## pgvector use later

Only `amani_knowledge` receives USAGE on `extensions`, EXECUTE on its functions and
USAGE on `vector`, `halfvec`, `sparsevec`. Extension objects stay admin-owned.
Knowledge will create its own embedding tables/indexes via future migrations, using
qualified types such as `extensions.vector`. No dimensions, distance policy, vector
index or chunk model is selected here. pgvector similarity is not authorization.
The pinned [extension control file](https://github.com/pgvector/pgvector/blob/v0.8.6/vector.control)
permits installation in a dedicated schema.

## Existing volumes and failures

The image runs init scripts **only when its data directory is empty**. Updating
`.env` does not rotate stored passwords, change old host-auth rules, or rerun SQL.
A failed first initialization can leave PGDATA present and the vector step committed;
ordinary restart will not resume skipped scripts. Hence `restart: "no"` and mandatory
verification. See the [official image behavior](https://hub.docker.com/_/postgres).

Before adopting these scripts on an existing volume, back up and inspect its roles,
objects, ownership and `pg_hba.conf`. The earlier starter installed vector in `public`;
this new initializer intentionally refuses that location. A DBA-reviewed migration
must plan extension relocation, dependent queries/search paths, old object grants,
SCRAM password/auth changes and ownership before applying this foundation. No
automatic migration, ownership takeover, password reset or volume deletion is provided.
Use a separately named disposable Compose project for a truly fresh development
instance only after checking port conflicts; do not discard the existing volume.

## Recover a first-init password preflight failure

The owner completed this recovery successfully on 2026-09-29. It does not need to
be repeated for an already verified database; retain the procedure for this specific
first-start failure on other local setups.

This procedure applies only when the first startup logs show `001-vector.sql`
committed successfully, then `002-service-isolation.sh` stopped with
`every administrator/service password must be distinct` before its SQL client call.
The database/admin and extension exist, but the six service roles have not been
created. Do not remove the volume or change `POSTGRES_PASSWORD`: that administrator
password is already stored in PostgreSQL.

Give the six service password variables distinct values in `.env`, preserving the
administrator credentials. In the observed local failure, only these six values
were regenerated; no database password was changed by the repair itself.

Run these owner commands one at a time from the root, stopping on any error:

```bash
npm run infra:check:local
npm run infra:up
docker compose exec -T postgres bash /docker-entrypoint-initdb.d/002-service-isolation.sh
npm run infra:verify:postgres
npm run infra:status
```

`infra:up` recreates containers with corrected environment/network settings and
preserves named volumes. PostgreSQL skips first-init scripts because PGDATA already
exists; the explicit shell command completes only the missing service-role step in
one transaction. Expected: ownership bootstrap completed, verification PASS, and
three healthy services with host mappings beginning `127.0.0.1:`. This is an explicit
recovery for the logged preflight failure, not a general migration/password-rotation
command for databases with existing service roles or business data.

## Owner-run verification

Before startup, `npm run infra:test` runs seven tests of the shell preflight/error
boundary with a fake `psql`. It cannot execute SQL or reach a database and is not
evidence that database grants or authentication work.

After following [startup instructions](../README.md), run from the repository root:

```bash
npm run infra:verify:postgres
```

[verify.sh](verify.sh) runs [verify.sql](verify.sql) in a read-only transaction as the
administrator, checking six role/schema owners, forbidden memberships/privileges,
PUBLIC/default grants and pgvector location/version. It then logs in over TCP using
each service's environment password, checks its identity/default schema, and confirms
a deliberately wrong password is rejected. No data is written and no test table is
created. Exit 0 plus PASS messages is expected and was confirmed in the owner's
2026-09-29 validation output.

The Compose `pg_isready` probe only means PostgreSQL accepts connections; it does
not prove authentication, initialization success or correct service isolation. Future
migrations must add real negative query tests and tenant/RLS tests with synthetic data.
Shutdown through `npm run infra:down` preserves the volume; backups/restores and
production provisioning remain future work.
