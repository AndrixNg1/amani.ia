# ADR-0035 — Authorization-Aware Knowledge Retrieval

**Status:** Accepted (2026-10-16)

## Context

Vector similarity has no knowledge of organization membership, plugin state or Knowledge grants. A global vector query followed by application-side filtering would allow unauthorized data to cross the persistence boundary and would distort the ranking of authorized evidence.

## Decision

Knowledge owns semantic retrieval. It first obtains a fresh Core decision for the caller's organization and `knowledge.documents.read` permission. Core remains responsible for active membership, plugin installation and entitlement. Knowledge then applies its existing base/document grant inheritance in the PostgreSQL query itself.

The query restricts candidates by organization, active base/source/document, current document version, `ready` processing state, exact embedding profile and local grants before the pgvector cosine-distance ordering. Restricted documents require both a matching base grant and matching document grant. `inherit` documents require the base grant. The current version is the highest version for a document; an older ready version does not remain searchable while a newer version is pending or failed.

The retrieval profile is provider, model, dimension and configuration version. Query embeddings and chunks must match all four values. The alpha implementation uses exact cosine search (`<=>`) because stored vectors have variable dimensions; a global HNSW index would not be safe. Relation indexes support the authorization and lifecycle predicates.

Knowledge returns provenance-bound evidence and citation identifiers. A future Orchestrator calls this API; it never queries Knowledge PostgreSQL directly. An LLM is never an authorization decision point.

## Consequences

- Unauthorized chunks never enter ranking, deduplication, an Orchestrator or an LLM prompt.
- ACL changes immediately affect future queries without re-embedding documents.
- Retrieval costs include a Core policy request and a query embedding request; both fail closed.
- ANN indexing is deferred until a stable, dimension-specific embedding profile is adopted and measured.
- No answer generation, chat, connectors, cache or hybrid search is introduced.

## Related decisions

- ADR-0008 PostgreSQL and pgvector
- ADR-0010 multi-tenant isolation
- ADR-0012 roles, permissions and resources
- ADR-0013 permission-aware AI
- ADR-0018 AI Orchestrator
- ADR-0019 Knowledge RAG
- ADR-0032 Knowledge access and uploads
- ADR-0034 document processing representation
