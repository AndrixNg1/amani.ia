# Knowledge plugin

Knowledge is the organization-scoped documentary knowledge boundary on port `4101`.
It owns Knowledge bases, documentary sources, logical documents, immutable upload
versions, local resource grants, ingestion intents and local audit context. Its database
schema is `knowledge` and its fixed PostgreSQL login is `amani_knowledge`.

It does not own users, memberships, roles, plans, plugin installation or entitlement:
Core Platform decides those. It does not own connector credentials or synchronization:
the future Connectors plugin does. It does not own datasets, database queries or
calculations: Data Analytics does. Knowledge owns document-processing state, chunks and
embeddings; the separate worker performs bounded computation through internal APIs. It
implements secure evidence retrieval, but not RAG answer generation, question answering
or LLM chat.

## Sources and ownership

`KnowledgeSource` is documentary only. A `manual_upload` source is available now;
`connector` is reserved for an opaque future connector reference. Provider metadata
does not contain a token, secret, raw database connection string or document binary.
Documentary sources (PDF, DOCX, TXT, Markdown, Notion, Drive or SharePoint) will feed
Knowledge. Structured sources (PostgreSQL, MySQL, Excel or CSV) remain owned by Data
Analytics and must not be converted wholesale into RAG text.

## Authorization

Each protected request needs a verified service delegation; arbitrary identity headers
are never trusted. The local development adapter is disabled by default and accepts
only a short-lived HMAC-bound Gateway delegation on loopback. Knowledge calls Core for
a fresh decision: read uses `knowledge.documents.read`, ingestion `plugins.use`, and
management `plugins.manage`, all with the `knowledge` plugin enabled.

Core returns the caller's active membership ID. Knowledge then applies local grants.
Base grants deny by default. A document in `inherit` mode needs the matching base grant;
a `restricted` document needs both the base grant and matching document grant. Grants
are membership-scoped with no cross-schema foreign key to Core. Every lookup includes
`organization_id`; cross-tenant resources behave as not found.

## Upload lifecycle

1. Create a manual source under an authorized Knowledge base.
2. Initiate `POST /knowledge-bases/:id/uploads?organizationId=...` with that source,
   title, MIME, exact byte size and idempotency key.
3. Upload directly with the returned short-lived S3 POST policy. The server never
   proxies document bytes and clients never receive MinIO credentials.
4. Finalize `POST /uploads/:versionId/finalize?organizationId=...`.

The service generates an opaque key (`knowledge/<tenant>/<document>/<version>/original`),
requires a private, versioned bucket, verifies exact metadata, pins its S3 VersionId and
hashes that exact object with SHA-256. PostgreSQL retains metadata and the pinned object
reference; MinIO stores only the binary. `pending` creates one durable ingestion intent
and outbox record. BullMQ delivers its versioned contract to the document-processing
worker at least once. The worker asks Knowledge to revalidate the document, tenant and
requester's current rights before it receives a short-lived pinned download URL, and
again before it publishes chunks or marks the version ready. Retried initiation with
the same key and payload returns the original intent;
retrying finalization does not create a new version or job. SQL and object storage are
not one transaction: unfinalized private objects require operator lifecycle cleanup.
Archiving is logical only; it never silently deletes evidence or future citations.

## Processing lifecycle

`pending → processing → ready` is the successful lifecycle. A bounded retry keeps the
same job ID and may re-enter `processing`; duplicate batches upsert the same chunk index.
After the final attempt, Knowledge records `failed` with a safe code. `ready` is only
set after the expected number of chunks and embeddings exists in the Knowledge schema.
The worker supports PDF text extraction, DOCX, UTF-8 TXT and Markdown. PDF without
extractable text fails safely; OCR, external URL fetching, macro execution, and RAG
answer generation are not implemented. See the worker README and ADR-0033/0034.

## Secure retrieval

`POST /knowledge/retrieval` accepts `organizationId`, a non-empty `query`, optional
`knowledgeBaseId`, bounded `topK`, and optional `minSimilarityBps` (0–10000). The
identity context is authoritative: the body organization must match the verified
organization and is never an authorization claim.

The request flow is: verified identity → Core authorization (`knowledge.documents.read`,
active membership, Knowledge installation and entitlement) → Knowledge resource grants
→ compatible query embedding → PostgreSQL candidate query → ranked authorized evidence.
Core failures fail closed. Knowledge uses the existing conservative inheritance model:
an `inherit` document requires a read grant on its knowledge base; a `restricted`
document additionally requires its own document read grant.

The SQL query applies organization, active base/source/document, local grants, embedding
provider/model/dimension/configuration version and lifecycle predicates before pgvector
orders candidates. It uses cosine distance (`<=>`) and returns `1 - distance` as a
similarity score; this is relevance only, never confidence. Only the latest version of a
document participates, and only when that version is `ready`. Pending, processing,
failed, archived and superseded content is excluded even when chunk rows remain.

The response is `KnowledgeRetrievalResponseV1`. Each result includes the authorized
chunk and a Knowledge-owned citation path: knowledge base, source, document, version and
chunk IDs, plus title, page and section metadata when available. Citation IDs are not
permanent access grants: any future source-opening operation must authorize again.

The query embedding must match the persisted provider, model, dimension and configuration
version exactly. The alpha uses exact filtered search because vectors have variable
dimensions; no global ANN/HNSW index is safe yet. There is no retrieval-response cache.
Queries, chunk content, vectors, signed URLs and provider credentials are not written to
ordinary logs. The provider has bounded query length, top-K and timeout; failure is a
controlled error and never falls back to unsecured keyword search.

The future AI Orchestrator must call this API and must not query Knowledge PostgreSQL or
ACL tables directly. It receives authorized evidence only. Hybrid search, reranking,
answer generation, conversations, connectors and frontends remain out of scope. See
ADR-0035 and `docs/architecture/diagrams/21-secure-knowledge-retrieval.mmd`.

## Environment and manual commands

Copy only the required server-side values into `.env` from `.env.example`. The MinIO
bucket `amani-knowledge-originals` must be private and versioning must be enabled before
readiness or uploads can succeed. Do not use the root PostgreSQL superuser, MinIO admin
credentials, or a public bucket.

```bash
cd /home/andrix-ng/Bureau/amani.ia
npm install
npm run env:local --workspace=@amani/knowledge
npm run db:migrate --workspace=@amani/knowledge
npm run lint:check --workspace=@amani/knowledge
npm run typecheck --workspace=@amani/knowledge
npm run build --workspace=@amani/knowledge
npm test --workspace=@amani/knowledge
npm run start:dev --workspace=@amani/knowledge
```

The migration is checked in but has not been executed by this change. See ADR-0031 and
ADR-0032 for enterprise-source boundaries and the ACL/upload decision. Retrieval also
requires the `KNOWLEDGE_RETRIEVAL_EMBEDDING_*` profile to match chunks written by the
worker. Set the same provider/model/dimension/configuration version deliberately; never
place an embedding API key in browser configuration.

The generated local environment intentionally keeps service authentication disabled, so
it cannot exercise retrieval. For a local retrieval test, enable development service
authentication in the Core and Knowledge `.env` files. Core needs
`CORE_SERVICE_AUTH_MODE=development`, its normal `DEVELOPMENT_SERVICE_SECRET`, and a
distinct `KNOWLEDGE_CORE_DEVELOPMENT_SECRET`. Knowledge needs
`KNOWLEDGE_SERVICE_AUTH_MODE=development`, a separate
`KNOWLEDGE_DEVELOPMENT_SERVICE_SECRET` for the trusted caller, the same
`KNOWLEDGE_CORE_DEVELOPMENT_SECRET`, and the document-processing secret. All values are
server-only, 64-character lowercase hexadecimal strings; production identity remains an
open architecture decision.

## Tests and next phase

Retrieval unit tests use synthetic vectors and mocked Core/database/provider boundaries.
They cover Core-before-query behavior, candidate SQL scope, provenance mapping and
controlled provider failures. HTTP tests cover verified organization and signed
Knowledge Base scope before the retrieval service is invoked. Database integration
validation must cover tenant and grant isolation, ready/current lifecycle, profile
compatibility, ranking and top-K. Tests are **NOT RUN BY REQUEST**.

Phase 8 may add an AI Orchestrator that consumes this endpoint. It must not introduce a
second retrieval engine or bypass this authorization boundary.
