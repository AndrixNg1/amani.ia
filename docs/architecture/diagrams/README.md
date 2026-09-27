# Architecture diagrams

This directory contains the visual architecture catalog for **Amani IA**. All 19 numbered diagrams (00–18) describe the **target architecture**, not completed features. The three Mermaid diagrams at the end separately document the initialized repository, planned backend integration, and required authorization flow.

> **Implementation status:** The Next.js and NestJS applications are initialized, and local infrastructure configuration is prepared. Authentication, service-to-service clients, policy enforcement, persistent business data, queues, and AI/RAG integrations remain planned until implemented and verified.

## 00 — Global architecture — target design

[![Amani IA — Global architecture and service communication](./00-global-architecture.png)](./00-global-architecture.png)

The global architecture shows the three Next.js frontends, NestJS API Gateway, Core Platform API, AI Orchestrator, five independently deployable NestJS Plugin APIs, planned workers, PostgreSQL/pgvector, Redis, and MinIO/S3. Plugin activation is **per organization**, not one container per customer. API-to-API calls must authenticate the calling service and propagate a verifiable, bounded user and organization context.

**Related decision:** [ADR-0030 — Global architecture](../adr/0030-global-architecture.md).

## Diagram catalog (01–18)

Use the diagram links to open the full-resolution PNG. The preview column provides an overview inside GitHub; keep the original image files in this directory with the **exact filenames** below.

### Architecture and repository

| # | Diagram | Scope | Preview | Related ADR |
|:--:|---|---|---|---|
| 01 | [System context](./01-system-context.png) | Users, organization administrators, SaaS operators, and external systems | <img src="./01-system-context.png" alt="Amani IA — System context" width="170"> | [ADR-0010](../adr/0010-multi-tenant-isolation.md) |
| 02 | [Applications and services](./02-applications-and-services.png) | Next.js frontends, NestJS platform APIs, plugins, workers, and shared infrastructure | <img src="./02-applications-and-services.png" alt="Amani IA — Applications and services" width="170"> | [ADR-0002](../adr/0002-plugin-backend.md) |
| 03 | [Monorepo structure](./03-monorepo-structure.png) | npm workspaces, deployable services, reserved packages, and workers | <img src="./03-monorepo-structure.png" alt="Amani IA — Monorepo structure" width="170"> | [ADR-0001](../adr/0001-npm-monorepo.md) |
| 04 | [Backend communication](./04-backend-communication.png) | Planned authenticated API-to-API calls and service responsibilities | <img src="./04-backend-communication.png" alt="Amani IA — Backend communication" width="170"> | [ADR-0005](../adr/0005-backend-sync-communication.md) |

### Processing, data, and authorization

| # | Diagram | Scope | Preview | Related ADR |
|:--:|---|---|---|---|
| 05 | [Async processing](./05-async-processing.png) | Redis queues, background workers, job status, and retries | <img src="./05-async-processing.png" alt="Amani IA — Async processing" width="170"> | [ADR-0006](../adr/0006-async-events-jobs.md) |
| 06 | [Data ownership and PostgreSQL](./06-data-ownership-postgresql.png) | Service-owned persistence, pgvector, object storage, and tenant isolation | <img src="./06-data-ownership-postgresql.png" alt="Amani IA — Data ownership and PostgreSQL" width="170"> | [ADR-0009](../adr/0009-data-ownership-migrations.md) |
| 07 | [Authorization flow](./07-authorization-flow.png) | Identity, organization membership, permissions, and access decisions | <img src="./07-authorization-flow.png" alt="Amani IA — Authorization flow" width="170"> | [ADR-0012](../adr/0012-roles-permissions-resources.md) |
| 08 | [Permission-aware AI](./08-permission-aware-ai.png) | Filtering before retrieval and limiting AI answers and citations to authorized data | <img src="./08-permission-aware-ai.png" alt="Amani IA — Permission-aware AI" width="170"> | [ADR-0013](../adr/0013-permission-aware-ai.md) |
| 09 | [Plugin lifecycle](./09-plugin-lifecycle.png) | Catalog, organization installation, activation, updates, and deactivation | <img src="./09-plugin-lifecycle.png" alt="Amani IA — Plugin lifecycle" width="170"> | [ADR-0015](../adr/0015-plugin-registry-lifecycle.md) |

### AI and business plugins

| # | Diagram | Scope | Preview | Related ADR |
|:--:|---|---|---|---|
| 10 | [Knowledge ingestion](./10-knowledge-ingestion.png) | Document ingestion, asynchronous processing, embeddings, and indexing | <img src="./10-knowledge-ingestion.png" alt="Amani IA — Knowledge ingestion" width="170"> | [ADR-0019](../adr/0019-knowledge-rag.md) |
| 11 | [Knowledge RAG query flow](./11-knowledge-rag-query-flow.png) | Authorized semantic retrieval, grounded generation, and source citations | <img src="./11-knowledge-rag-query-flow.png" alt="Amani IA — Knowledge RAG query flow" width="170"> | [ADR-0019](../adr/0019-knowledge-rag.md) |
| 12 | [Data Analytics plugin](./12-data-analytics-plugin.png) | Dataset ingestion, scoped analysis, Python Data Engine, and results | <img src="./12-data-analytics-plugin.png" alt="Amani IA — Data Analytics plugin" width="170"> | [ADR-0020](../adr/0020-data-analytics.md) |
| 13 | [AI Orchestrator](./13-ai-orchestrator.png) | Request routing, authorized tool selection, execution, and synthesis | <img src="./13-ai-orchestrator.png" alt="Amani IA — AI Orchestrator" width="170"> | [ADR-0018](../adr/0018-ai-orchestrator.md) |
| 14 | [Conversations plugin](./14-conversations-plugin.png) | Conversation lifecycle, persistence, context, and history access | <img src="./14-conversations-plugin.png" alt="Amani IA — Conversations plugin" width="170"> | [ADR-0021](../adr/0021-conversations.md) |

### SaaS experience and deployment

| # | Diagram | Scope | Preview | Related ADR |
|:--:|---|---|---|---|
| 15 | [Organization onboarding](./15-organization-onboarding.png) | Organization creation, plugin selection, membership, and initial access | <img src="./15-organization-onboarding.png" alt="Amani IA — Organization onboarding" width="170"> | [ADR-0017](../adr/0017-organization-onboarding.md) |
| 16 | [Roles and permissions model](./16-roles-and-permissions-model.png) | Organization-specific roles and scoped access to plugins and resources | <img src="./16-roles-and-permissions-model.png" alt="Amani IA — Roles and permissions model" width="170"> | [ADR-0012](../adr/0012-roles-permissions-resources.md) |
| 17 | [Frontend architecture](./17-frontend-architecture.png) | Website, SaaS Admin, Enterprise Portal, and reusable Next.js UI | <img src="./17-frontend-architecture.png" alt="Amani IA — Frontend architecture" width="170"> | [ADR-0025](../adr/0025-nextjs-frontends.md) |
| 18 | [Deployment diagram](./18-deployment-diagram.png) | Logical environments, independent deployment, CI/CD, and operations | <img src="./18-deployment-diagram.png" alt="Amani IA — Deployment diagram" width="170"> | [ADR-0029](../adr/0029-deployment-cicd-testing.md) |

## How to read these visuals

- **Target design is not implementation status.** The PNGs are high-level illustrations, including some examples of possible features or vendors. Their arrows do not establish a working connection or an approved wire protocol.
- **The ADRs govern architectural decisions.** Where an infographic includes illustrative or unselected technology (for example, a plugin marketplace/sandbox, NextAuth, a separate analytics warehouse, Vue/Vite, or a specific cloud/Kubernetes deployment), do not treat that element as approved or implemented. The agreed frontend stack is **Next.js**; no production hosting provider or plugin package marketplace has been selected here.
- **Each plugin API owns and authorizes its own data.** The Core Platform manages organization identity, membership, roles, entitlements, and the plugin registry; plugin services enforce effective permission and tenant scope before any retrieval or computation.
- **Keep editable sources alongside exports.** Add a `.mmd` file with the same basename when a corresponding diagram has been reviewed and rebuilt in Mermaid. Until such a source exists, treat its PNG as a visual reference rather than an executable architecture specification.

## File and naming conventions

All images shown above are expected in `docs/architecture/diagrams/` (alongside this README). Rename the earlier global image from `01-global-architecture.png` to `00-global-architecture.png` so that `01-system-context.png` has its own unambiguous filename. PNGs should use the exact numbered basenames in the catalog. Do not commit duplicate exports under unnumbered generator filenames.

---

## Current repository

The nodes below represent initialized code or prepared configuration. There are deliberately no runtime communication edges: service clients and business integrations have not been implemented.

```mermaid
flowchart TB
    subgraph frontends["Initialized Next.js frontends"]
        website["website :3000"]
        enterprise["enterprise :3001"]
        admin["admin :3002"]
    end
    subgraph platform["Initialized NestJS applications"]
        gateway["gateway :4000"]
        core["core-api :4001"]
        orchestrator["ai-orchestrator :4002"]
    end
    subgraph plugins["Initialized NestJS Plugin APIs"]
        knowledge["knowledge :4101"]
        analytics["data-analytics :4102"]
        conversations["conversations :4103"]
        connectors["connectors :4104"]
        evaluation["evaluation :4105"]
    end
    subgraph infrastructure["Local Compose configuration; no app clients"]
        postgres["PostgreSQL + pgvector :5432"]
        redis["Redis :6379"]
        minio["MinIO API :9000 / console :9001"]
    end
    placeholders["Documentation placeholders: packages / workers / root tests"]
```

## Intended backend architecture

Every dashed edge is planned, not a working integration. Frontends must not receive privileged backend credentials. Each Plugin API is an independent authorization boundary.

```mermaid
flowchart LR
    frontends["Next.js frontends"] -. "Application requests" .-> gateway["Gateway"]
    gateway -. "Organization and identity operations" .-> core["Core API"]
    gateway -. "Verified user and organization context" .-> orchestrator["AI Orchestrator"]
    orchestrator -. "Authorized operations only" .-> plugins["Independent Plugin APIs"]
    plugins -. "Membership and permission verification" .-> core
    plugins -. "Tenant-scoped data access" .-> storage["PostgreSQL / pgvector / MinIO"]
    plugins -. "Scoped background jobs and cache" .-> redis["Redis"]
    redis -. "Jobs with verified scope" .-> workers["Planned workers"]
    workers -. "Authorized, tenant-scoped processing" .-> storage
```

Storage ownership, transport credentials, permission lookup protocols, and job processing are not yet implemented. The diagram groups the five Plugin APIs for readability; it does not combine them into a single service.

## Required authorization flow

This sequence is a requirement for future business requests. None of the policy checks shown are implemented by the current health or starter routes.

```mermaid
sequenceDiagram
    participant U as User
    participant G as Gateway
    participant O as AI Orchestrator
    participant P as Plugin API
    participant C as Core API / policy authority
    participant D as Tenant-scoped storage
    U->>G: Request with authenticated identity and selected organization
    G->>C: Verify identity, membership, and operation permission
    C-->>G: Verified scope or rejection
    G->>O: Verifiable service and delegated user context
    O->>P: Requested operation with bounded authorization context
    P->>C: Verify current organization and resource permissions
    C-->>P: Authorized scope or rejection
    alt Identity, membership, or permission invalid
        P-->>O: Deny access
    else Authorized
        P->>D: Read only resources in verified scope
        D-->>P: Authorized data
        P-->>O: Authorized result
        O-->>G: Response based only on authorized data
        G-->>U: Response
    end
```

The policy authority interaction is conceptual: no endpoint or token protocol has been selected. All denial paths must stop data access, including failures at the gateway or orchestrator.
