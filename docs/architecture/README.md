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
| Data analytics | `@amani/data-analytics` | NestJS / TypeScript | 4102 | Structured-source metadata, private uploads and constrained analysis intent |
| Conversations | `@amani/conversations` | NestJS / TypeScript | 4103 | Conversation history and access |
| Connectors | `@amani/connectors` | NestJS / TypeScript | 4104 | External source connections |
| Evaluation | `@amani/evaluation` | NestJS / TypeScript | 4105 | AI evaluation workflows |

Backend `GET /health` endpoints provide minimal process liveness. They do not verify database connectivity, dependent services, authentication, readiness for customer traffic, or tenant isolation. Core also has `/health/ready` for its database; Gateway `/ready` checks configured auth providers and Core readiness. Other backends remain scaffolds.

## Intended backend communication

The browser-facing gateway is the entry point for application requests. It routes to Core
and exposes the bounded Knowledge RAG route through AI Orchestrator. Plugin APIs remain
independent backend services; each independently enforces organization and resource
permissions even when an upstream service already authorized the request.

Gateway has explicit `/api/platform/...` and `/api/ai/organizations/:organizationId/knowledge-rag`
routes, bounded native-fetch clients, authentication/service-authentication ports, Core
permission checks and HTTP protections. Default identity verification denies access;
optional cryptographic adapters are restricted to explicit local development. A liveness
response alone does not establish connectivity or authorization.

The Core API implements organization membership, RBAC, plan/installation checks and internal policy HTTP endpoints. Gateway asks Core for explicit permission and Core reauthorizes business operations. A user's identity and their membership of a selected organization are separate checks. An arbitrary tenant header is never sufficient proof of either.

The AI Orchestrator must retrieve only resources the requesting user is authorized to access in the verified organization. It must never load all tenant data and rely on an LLM prompt to filter the result. See the [authorization requirements](authorization.md) for the required trust boundaries.

## Shared packages and workers

[Shared packages](../../packages/README.md) implement transport types, identifiers, environment parsing and safe tracing helpers. Gateway and Core consume them. Prompts, UI and SDK remain reserved. No shared ORM or authorization engine exists.

[Workers](../../workers/README.md) contain the initialized TypeScript document-processing
worker and the reserved Python Data Engine. The document worker is a workspace, consumes
versioned Knowledge ingestion jobs through Redis/BullMQ, and publishes bounded results
only through Knowledge. The Data Engine remains reserved.

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
| Knowledge resource access guards and tenant isolation | Implemented for Knowledge; other plugins remain future work |
| Secure Knowledge retrieval | Implemented in Knowledge; manual validation pending |
| AI Orchestrator + Knowledge RAG | Implemented locally; manual validation pending |
| Shared packages | Four implemented packages |
| Core/Gateway integration tests | Dedicated HTTP and PostgreSQL suites; commands in component READMEs |
| Knowledge document processing | Current: queue, worker, extraction, normalization, chunks and embeddings; manual validation pending |
| Data Analytics structured-data foundation | Implemented; manual validation pending; Python execution remains Phase 10 |
| OCR, connectors and hybrid orchestration | Not implemented |

Production authentication, deployment and plugin resource controls remain open. See [Gateway](../../apps/gateway/README.md) and [Core](../../apps/core-api/README.md) for implemented behavior and validation commands.

[Diagrams](diagrams/README.md) show both the current repository and intended communication. [The ADR index](adr/README.md) lists the recorded decisions and their accepted/proposed status.

## Secure Knowledge retrieval (16 October 2026)

[Secure Knowledge retrieval](diagrams/21-secure-knowledge-retrieval.mmd) is the editable
Mermaid source governed by ADR-0035. Core authorization and Knowledge resource grants
form the candidate scope before the exact pgvector cosine search. Only the current
`ready` version of active resources with a compatible embedding profile can appear in
results. The output is authorized evidence with Knowledge-owned provenance. The AI
Orchestrator consumes that evidence and never accesses Knowledge PostgreSQL
or pgvector directly. [Grounded Knowledge RAG](diagrams/22-ai-orchestrator-grounded-knowledge-rag.mmd)
documents delegation, context limits, provider isolation and server-owned citations. No
renderer command is configured, so no PNG was generated.
