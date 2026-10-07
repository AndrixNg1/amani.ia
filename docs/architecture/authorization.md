# Organization authorization requirements

Status: Core organization policy is implemented. Gateway delegates permission checks and implements protected HTTP routes, with optional local-only user/service authentication. Production authentication and Plugin API resource guards remain open. See the [Gateway README](../../apps/gateway/README.md) and [Core README](../../apps/core-api/README.md) for validation commands.

The following requirements apply to every business operation in every Plugin API. They also apply to background jobs and AI tool calls. A service account or an internal network location must not grant unrestricted access to user data.

## Identity, organization, and resource checks

1. Authenticate the calling backend using a verifiable service identity. The specific transport and credential mechanism remains to be selected.
2. Verify the requesting user's identity through a trusted authentication mechanism. Do not trust user IDs or role names supplied in an unsigned request header.
3. Resolve the requested organization and verify the user's current membership and relevant organization permissions. Authentication alone does not establish tenant membership. A tenant header can select an organization, but cannot prove access to it.
4. Confirm that the requested plugin capability is allowed for that organization and that the operation is allowed for this user.
5. Check the resource-level permission for every object being read, created, updated, or deleted. Scope every lookup, search, and mutation to the verified organization, including IDs supplied by the caller.
6. Reject missing, invalid, expired, ambiguous, or unverifiable identity or authorization context. Do not fall back to a default tenant or administrative access when a dependency fails.

The Core API is the implemented authority for organization membership and permissions. Each Plugin API remains responsible for enforcing the resulting policy at its own boundary and resource access layer. Core policy APIs and tenant role rules are documented in its README. Gateway has no policy cache. Production token/delegation format and lifecycle remain decisions; the local development signing adapter does not select a production protocol.

## Backend-to-backend context

Gateway and orchestrator calls must carry verifiable service identity and a bounded, integrity-protected user and organization context. Receiving services must validate the context for their own audience and operation. Service identity answers which backend is calling; it does not replace user permission checks.

Raw client-supplied tenant, user, or role headers must not become trusted internal context by forwarding them. Trust requires verification. Health endpoints are process liveness only and do not authorize application calls.

Backend URLs are deployment configuration, not proof of trust. Secrets and service credentials must stay server-side. Public frontend environment variables must never contain them.

## AI Orchestrator

The orchestrator must call only the authorized Plugin API operations for the requesting user and verified organization. Authorization must be applied before documents, dataset rows, conversation messages, or connector output enter retrieval results, prompts, model context, caches, or generated responses.

The orchestrator must preserve the same context across each tool call. Generated tool arguments and retrieved instructions are untrusted input and cannot choose another tenant, elevate permissions, or authorize additional resources. An LLM must not decide access policy.

Retrieval queries, vector search, pagination, counts, citations, and generated downloads must respect the same organization and resource scope. A later prompt telling a model to hide forbidden data cannot repair unauthorized retrieval.

## Plugin boundaries

| Plugin API | Required access scope |
| --- | --- |
| Knowledge | Organization and per-document/source permissions for ingestion, retrieval, vectors, and citations |
| Data analytics | Organization and dataset/query permissions before analysis or export |
| Conversations | Organization, conversation ownership/sharing policy, and message access |
| Connectors | Organization, connection permissions, source scopes, and server-side credential isolation |
| Evaluation | Organization and permissions for evaluation inputs, runs, artifacts, and results |

Actual ownership and sharing rules are not implemented. They must be defined and tested before exposing the corresponding operations.

## Storage, background work, and audit

Storage paths, queries, cache keys, and queue payloads must carry organization scope. Object storage credentials must not permit browsers or workers to bypass application policy. The choice of additional database enforcement, such as row-level security, is pending; its existence must not be assumed.

Jobs must preserve verified organization and actor context and re-evaluate permissions when execution requires current authorization. Workers must reject jobs without valid scope. Retries and cached results must not cross tenant boundaries.

Audit events should identify the actor, service, organization, operation, and authorization outcome without logging secrets, complete prompts, or customer payloads. The logging and retention implementation remains pending.

## Required future validation

Before any real tenant data is introduced, add negative tests for cross-organization resource IDs, forged tenant/user headers, authenticated non-members, revoked membership, insufficient resource permissions, direct Plugin API calls, missing service identity, scoped vector retrieval, cached results, and background jobs.

Core and Gateway suites cover their implemented boundaries; they do not establish security properties for the still-unimplemented Plugin APIs, retrieval or jobs. See the [repository test placeholders](../../tests/README.md).
