# Architecture diagrams

These diagrams distinguish the scaffolds currently present from intended service communication. Mermaid renders in compatible Markdown viewers.

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
