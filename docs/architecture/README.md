# Architecture

Amani IA is organized as a multi-tenant, plugin-based AI SaaS. This document separates the intended service boundaries from the code that exists today.

## Current repository

Eleven projects have a `package.json` and application source: three Next.js frontends and eight NestJS backends. They are npm workspaces under `apps/*` and `plugins/*`. Four additional shared workspaces (`types`, `contracts`, `config`, `shared`) are initialized under `packages/*`, giving 15 npm workspaces.

| Project | Package | Technology | Development port | Intended responsibility |
| --- | --- | --- | --- | --- |
| Website | `@amani/website` | Next.js / React / TypeScript | 3000 | Public website |
| Enterprise | `@amani/enterprise` | Next.js / React / TypeScript | 3001 | Organization user experience |
| Admin | `@amani/admin` | Next.js / React / TypeScript | 3002 | Administrative user experience |
| Gateway | `@amani/gateway` | NestJS / TypeScript | 4000 | Backend entry point and routing |
| Core API | `@amani/core-api` | NestJS / TypeScript | 4001 | Identity, organizations, membership, and permissions |
| AI Orchestrator | `@amani/ai-orchestrator` | NestJS / TypeScript | 4002 | AI workflows using authorized Plugin API data |
| Knowledge | `@amani/knowledge` | NestJS / TypeScript | 4101 | Knowledge ingestion and retrieval |
| Data analytics | `@amani/data-analytics` | NestJS / TypeScript | 4102 | Dataset queries and analysis |
| Conversations | `@amani/conversations` | NestJS / TypeScript | 4103 | Conversation history and access |
| Connectors | `@amani/connectors` | NestJS / TypeScript | 4104 | External source connections |
| Evaluation | `@amani/evaluation` | NestJS / TypeScript | 4105 | AI evaluation workflows |

Backend `GET /health` endpoints provide minimal process liveness. They do not verify database connectivity, dependent services, authentication, readiness for customer traffic, or tenant isolation. Core also has `/health/ready` for its database; Gateway `/ready` checks configured auth providers and Core readiness. Other backends remain scaffolds.

## Intended backend communication

The browser-facing gateway is the intended entry point for application requests. It routes explicitly to Core; AI Orchestrator routing remains planned. Plugin APIs are independent backend services; the orchestrator will call them through authenticated backend-to-backend requests. Each Plugin API must independently enforce organization and resource permissions, even if an upstream service already authorized the request.

Gateway has explicit `/api/platform/...` routes, one bounded native-fetch Core client, authentication/service-authentication ports, Core permission checks and HTTP protections. Default identity verification denies access; optional cryptographic adapters are restricted to explicit local development. Other service integrations remain planned. A liveness response alone does not establish connectivity or authorization.

The Core API implements organization membership, RBAC, plan/installation checks and internal policy HTTP endpoints. Gateway asks Core for explicit permission and Core reauthorizes business operations. A user's identity and their membership of a selected organization are separate checks. An arbitrary tenant header is never sufficient proof of either.

The AI Orchestrator must retrieve only resources the requesting user is authorized to access in the verified organization. It must never load all tenant data and rely on an LLM prompt to filter the result. See the [authorization requirements](authorization.md) for the required trust boundaries.

## Shared packages and workers

[Shared packages](../../packages/README.md) implement transport types, identifiers, environment parsing and safe tracing helpers. Gateway and Core consume them. Prompts, UI and SDK remain reserved. No shared ORM or authorization engine exists.

[Workers](../../workers/README.md) reserve data-engine and document-processing responsibilities. Neither worker has an application, package manifest, queue integration, or runtime selected. They are outside the current root workspace patterns.

## Local infrastructure

The local Compose foundation defines PostgreSQL with pgvector on port 5432, Redis on port 6379, and MinIO on ports 9000 (API) and 9001 (console). See [infrastructure](../../infrastructure/README.md) for configuration and startup checks.

These containers support future relational/vector storage, queues/cache, and object storage. Core uses Drizzle/node-postgres with versioned migrations in its owned `core_platform` schema. Plugin storage policies, queue consumers and object-storage authorization remain unimplemented. Gateway has no database. Container health checks establish container availability only.

## Implementation status

| Capability | Status |
| --- | --- |
| Eleven application and Plugin API scaffolds | Present |
| Workspace configuration, development ports, environment examples | Foundational configuration |
| Backend process liveness endpoints | Minimal `GET /health` |
| PostgreSQL/pgvector, Redis, and MinIO | Validated local infrastructure; Core uses PostgreSQL, Gateway needs no Redis/MinIO |
| Gateway routing and backend clients | Explicit Core routes, bounded fetch, validation, errors, CORS, limits and safe logs |
| Identity verification, service authentication, organization authorization | Core tenant policy implemented; local-only identity/service adapters; production IAM/service mechanism pending |
| Plugin resource access guards and tenant isolation | Required; not implemented |
| AI retrieval and model integration | Not implemented |
| Shared packages | Four implemented packages |
| Core/Gateway integration tests | Dedicated HTTP and PostgreSQL suites; commands in component READMEs |
| Workers and repository-wide integration tests | Reserved |

Production authentication, deployment and plugin resource controls remain open. See [Gateway](../../apps/gateway/README.md) and [Core](../../apps/core-api/README.md) for implemented behavior and validation commands.

[Diagrams](diagrams/README.md) show both the current repository and intended communication. [The ADR index](adr/README.md) lists the 30 decisions and their accepted/proposed status.
