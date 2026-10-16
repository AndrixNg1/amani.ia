# Document Processing Worker

`@amani/document-processing` turns an accepted Knowledge document version into a
processed representation. It is a Node/TypeScript worker with no public HTTP endpoint,
no PostgreSQL connection and no MinIO credential. Knowledge remains the owner of job
state, document state, chunks and embeddings.

## Flow and queue

Knowledge finalization writes a durable ingestion request and outbox record. BullMQ
delivers `KnowledgeDocumentIngestionRequestedV1` from the environment-scoped queue
`amani:<environment>:knowledge:document-processing`. Delivery is at least once, with
three bounded exponential-backoff attempts. Queue data contains opaque resource IDs and
pinned object metadata; it never contains document bytes, database passwords, storage
credentials or signed URLs.

For each delivery the worker calls `POST /internal/document-processing/start`. Knowledge
authenticates the worker service, rechecks the requester’s current Core permission,
membership and local ACL, verifies current resource state, claims `pending → processing`
atomically, then returns a short-lived URL to the exact S3 VersionId. The worker uploads
batches through `/batches`, then calls `/complete`; a safe `/fail` operation records a
terminal code. These are internal service operations, never browser routes.

## Processing stages

The original is downloaded with exact size and SHA-256 verification. The worker accepts:

- `application/pdf`: text-based PDFs only; no text yields `NO_EXTRACTABLE_TEXT`.
- DOCX: textual paragraphs through Mammoth; macros and embedded content are not run.
- `text/plain`: UTF-8 only, with invalid/binary data rejected.
- `text/markdown`: inert UTF-8 text; code, links and images are not executed or fetched.

Normalization v1 converts line endings, removes unsafe controls, normalizes horizontal
whitespace and preserves paragraph/heading boundaries. Chunking v1 is deterministic and
paragraph-aware. It uses configurable character size and overlap, splits a pathological
paragraph at a safe whitespace boundary, preserves order, and derives a SHA-256 checksum
per chunk. Defaults are 1200 characters, 160 overlap and at most 2000 chunks.

## Embeddings and persistence

The narrow `EmbeddingProvider` abstraction has an OpenAI-compatible adapter and an
explicit `deterministic-test` adapter. The latter is accepted only in development/test
and is not a semantic embedding provider. Batches, timeout, response cardinality and
vector dimension are checked. Provider, model, dimension and configuration version are
stored with every Knowledge chunk.

Knowledge persists vectors in `extensions.vector` together with a per-row dimension.
No ANN index is selected before a model profile and phase-7 retrieval measurements.
There is no search, similarity ranking, user retrieval or RAG here.

## Limits, failures and retries

All limits are configuration: original bytes, extracted characters, detectable pages,
paragraph size, chunk count, worker timeout, concurrency and embedding batch size.
Safe terminal codes include `UNSUPPORTED_DOCUMENT_TYPE`, `NO_EXTRACTABLE_TEXT`,
`CHECKSUM_MISMATCH`, `TOO_MANY_CHUNKS`, `EMBEDDING_PROVIDER_UNAVAILABLE` and
`PERSISTENCE_FAILED`. Logs contain IDs, stage/attempt and outcome only: never document
text, filename, chunk content, vectors, signed URLs, tokens or secrets.

Duplicate delivery of the same job is safe: claim is compare-and-set, chunks are unique
per organization/version/index, and finalization verifies the complete expected count.
A transient error leaves the run processing for retry. The final attempt, a revoked
authorization or a stale job marks it failed. A future manual retry must create an
explicit new reprocessing operation; this worker does not provide an admin UI.

## Configuration and manual use

Copy `.env.example` to `workers/document-processing/.env` and use the same Redis
password/prefix as Knowledge. Enable `KNOWLEDGE_SERVICE_AUTH_MODE=development` only for
loopback development and configure a distinct shared 64-hex worker-to-Knowledge secret
on both services. Production service authentication remains unselected.

After the owner installs dependencies and starts infrastructure, Core and Knowledge,
run `npm run dev --workspace=@amani/document-processing`. The worker handles graceful
SIGINT/SIGTERM shutdown by pausing intake and closing its Redis connection after active
work completes.

## Security and non-goals

Document content is untrusted inert data. The worker does not execute commands, code,
macros or scripts and does not fetch URLs found in files. It does not accept archives;
DOCX is parsed only through its document library. Antivirus scanning is not provided and
remains a production hardening requirement. OCR, connectors, Data Analytics, Python Data
Engine, secure retrieval, vector ranking and RAG are outside this worker.

## Tests

Unit and integration test code uses only synthetic data and deterministic embeddings.
Tests are **NOT RUN BY REQUEST**. Run the workspace scripts documented in the root
README after reviewing dependency and environment changes.
