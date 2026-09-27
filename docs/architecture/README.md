# Architecture

Amani IA is organized as a multi-tenant, plugin-based AI SaaS. This document separates the intended service boundaries from the code that exists today.

## Current repository

Eleven projects have a `package.json` and application source: three Next.js frontends and eight NestJS backends. They are npm workspaces under `apps/*` and `plugins/*`. The `packages/*` workspace pattern reserves space for shared packages; its existing directories have no package manifests and are not initialized workspaces.

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

Backend `GET /health` endpoints provide minimal process liveness. They do not verify database connectivity, dependent services, authentication, readiness for customer traffic, or tenant isolation. The generated starter routes remain scaffolding.

## Intended backend communication

The browser-facing gateway is the intended entry point for application requests. It will route to the Core API and AI Orchestrator. Plugin APIs are independent backend services; the orchestrator will call them through authenticated backend-to-backend requests. Each Plugin API must independently enforce organization and resource permissions, even if an upstream service already authorized the request.

Service URL environment examples describe intended destinations. They do not implement forwarding, HTTP clients, service authentication, retries, or policy checks. A successful health response does not demonstrate that two services communicate.

The Core API is the intended authority for organization membership and permission information. The mechanism for distributing or checking that policy remains to be implemented. A user's identity and their membership of a selected organization are separate checks. An arbitrary tenant header is never sufficient proof of either.

The AI Orchestrator must retrieve only resources the requesting user is authorized to access in the verified organization. It must never load all tenant data and rely on an LLM prompt to filter the result. See the [authorization requirements](authorization.md) for the required trust boundaries.

## Shared packages and workers

[Shared packages](../../packages/README.md) reserve boundaries for contracts, types, configuration, prompts, UI, SDK, and shared utilities. They contain no executable implementation or dependencies yet.

[Workers](../../workers/README.md) reserve data-engine and document-processing responsibilities. Neither worker has an application, package manifest, queue integration, or runtime selected. They are outside the current root workspace patterns.

## Local infrastructure

The local Compose foundation defines PostgreSQL with pgvector on port 5432, Redis on port 6379, and MinIO on ports 9000 (API) and 9001 (console). See [infrastructure](../../infrastructure/README.md) for configuration and startup checks.

These containers support future relational/vector storage, queues/cache, and object storage. Application clients, schema migrations, tenant-aware storage policies, queue consumers, and storage access authorization are not implemented. Container health checks establish container availability only.

## Implementation status

| Capability | Status |
| --- | --- |
| Eleven application and Plugin API scaffolds | Present |
| Workspace configuration, development ports, environment examples | Foundational configuration |
| Backend process liveness endpoints | Minimal `GET /health` |
| PostgreSQL/pgvector, Redis, and MinIO | Local Compose configuration; app integration pending |
| Gateway routing and backend clients | Not implemented |
| Identity verification, service authentication, organization authorization | Not implemented |
| Plugin resource access guards and tenant isolation | Required; not implemented |
| AI retrieval and model integration | Not implemented |
| Shared packages, workers, repository-wide integration tests | Placeholder directories |

These scaffolds are not ready to process real customer or organization data. Tenant guards and permissions must be implemented and tested before business endpoints or data processing are enabled.

[Diagrams](diagrams/README.md) show both the current repository and intended communication. [ADR guidance](adr/README.md) records that no pre-existing ADRs were present; this documentation does not manufacture an accepted decision history.
