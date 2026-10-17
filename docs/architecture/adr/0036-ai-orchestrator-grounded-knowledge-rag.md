# ADR-0036 — AI Orchestrator and Grounded Knowledge RAG

**Status:** Accepted — manual validation required (2026-10-17)

## Context

Amani needs to answer questions over enterprise documents without turning a model into
an authorization or provenance system. Knowledge already owns document ACLs and secure
semantic retrieval. The AI Orchestrator needs to compose that capability while keeping
the authenticated requester visible at every downstream boundary.

## Decision

The implementation provides one stateless documentary flow only:

1. Gateway authenticates the caller and signs bounded local-development delegation.
2. AI Orchestrator verifies that delegation and validates that the body organization
   matches it.
3. AI Orchestrator asks Core for the existing `plugins.use` policy check for Knowledge.
4. AI Orchestrator calls `POST /knowledge/retrieval` with its own service identity and
   the verified requester identity and organization.
5. Knowledge independently rechecks Core policy and applies its own ACLs before its
   vector query. The Orchestrator never reads Knowledge PostgreSQL or pgvector.
6. A deterministic, bounded context builder assigns request-local evidence IDs (`E1`,
   `E2`, ...) to whole authorized chunks.
7. A versioned `knowledge-rag-v1` prompt places the question and untrusted evidence in
   separate data boundaries. Document text cannot request tools, network access, code
   execution, system prompts, or broader authorization.
8. A provider-neutral generation port returns structured `{ answer, evidenceIds }`.
   An OpenAI-compatible adapter is available; the deterministic adapter is restricted
   to development/test and has no network access.
9. The server accepts only evidence IDs supplied to that request and constructs every
   citation from Knowledge-owned provenance. Fabricated IDs never become citations.

If no authorized evidence fits the budget, or a model response selects no valid
evidence ID, the API returns `insufficient_evidence`. It does not fall back to general
chat or general world knowledge.

## Consequences

- Core, Knowledge and generation calls have bounded, separately configurable timeouts.
- The response carries safe retrieval/generation metadata but no prompt, document body,
  object-storage path, signed URL, ACL row, provider secret, or authorization detail.
- Operational logs contain identifiers, counts, model metadata, status and duration;
  they do not contain questions, evidence bodies, prompts or answers by default.
- Citations are provenance only. A future document-open action must ask Knowledge to
  authorize access again; a citation is never a capability token.
- The implementation deliberately excludes Analytics, connectors, conversations,
  evaluation, generic tool loops and query rewriting.

## Security

Service identity proves that a call originated at Gateway or AI Orchestrator. It does
not widen the delegated user's access. Each hop carries a signed, short-lived user and
organization context, and Knowledge remains the authoritative boundary for Knowledge
resources. The model receives only evidence already returned by ACL-aware retrieval;
it never performs authorization and never supplies document/source identifiers.

## Related decisions

- ADR-0005 synchronous backend communication
- ADR-0007 versioned contracts
- ADR-0010 multi-tenant isolation
- ADR-0011 user and service authentication
- ADR-0013 permission-aware AI
- ADR-0018 AI Orchestrator
- ADR-0019 Knowledge RAG
- ADR-0028 observability, resilience and secrets
- ADR-0035 authorization-aware Knowledge retrieval
