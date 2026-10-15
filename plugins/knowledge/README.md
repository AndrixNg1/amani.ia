# Knowledge plugin

Knowledge is the organization-scoped documentary knowledge boundary on port `4101`.
It owns Knowledge bases, documentary sources, logical documents, immutable upload
versions, local resource grants, ingestion intents and local audit context. Its database
schema is `knowledge` and its fixed PostgreSQL login is `amani_knowledge`.

It does not own users, memberships, roles, plans, plugin installation or entitlement:
Core Platform decides those. It does not own connector credentials or synchronization:
the future Connectors plugin does. It does not own datasets, database queries or
calculations: Data Analytics does. It does not parse documents, create chunks,
embeddings, retrieval, RAG, queues, workers or LLM calls in Phase 5.

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
reference; MinIO stores only the binary. `pending` creates one durable future-worker
intent. Retried initiation with the same key and payload returns the original intent;
retrying finalization does not create a new version or job. SQL and object storage are
not one transaction: unfinalized private objects require operator lifecycle cleanup.
Archiving is logical only; it never silently deletes evidence or future citations.

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
ADR-0032 for enterprise-source boundaries and the ACL/upload decision.
