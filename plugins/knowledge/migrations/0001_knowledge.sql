-- Run only as amani_knowledge. Infrastructure owns accounts, schema and extensions.
CREATE TABLE knowledge.knowledge_bases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, name text NOT NULL,
 description text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
 created_by_membership_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organization_id,id), UNIQUE (organization_id,name), CHECK (length(btrim(name)) BETWEEN 1 AND 120), CHECK (length(description) <= 2000));
CREATE TABLE knowledge.knowledge_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, knowledge_base_id uuid NOT NULL,
 source_kind text NOT NULL CHECK (source_kind IN ('manual_upload','connector')), provider text, display_name text NOT NULL,
 external_reference text, status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
 created_by_membership_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (organization_id,knowledge_base_id) REFERENCES knowledge.knowledge_bases(organization_id,id),
 UNIQUE (organization_id,id,knowledge_base_id), CHECK (length(btrim(display_name)) BETWEEN 1 AND 120),
 CHECK ((source_kind = 'manual_upload' AND provider IS NULL AND external_reference IS NULL) OR source_kind = 'connector'));
CREATE TABLE knowledge.documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, knowledge_base_id uuid NOT NULL, source_id uuid NOT NULL,
 title text NOT NULL, status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
 access_mode text NOT NULL DEFAULT 'inherit' CHECK (access_mode IN ('inherit','restricted')), created_by_membership_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (organization_id,knowledge_base_id) REFERENCES knowledge.knowledge_bases(organization_id,id),
 FOREIGN KEY (organization_id,source_id,knowledge_base_id) REFERENCES knowledge.knowledge_sources(organization_id,id,knowledge_base_id),
 UNIQUE (organization_id,id), CHECK (length(btrim(title)) BETWEEN 1 AND 240));
CREATE TABLE knowledge.document_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, document_id uuid NOT NULL, version integer NOT NULL,
 original_filename text NOT NULL, mime_type text NOT NULL, size_bytes integer NOT NULL, checksum_sha256 text,
 storage_bucket text NOT NULL, storage_key text NOT NULL, storage_version_id text,
 processing_status text NOT NULL DEFAULT 'awaiting_upload' CHECK (processing_status IN ('awaiting_upload','pending','processing','ready','failed','cancelled')),
 created_by_membership_id uuid NOT NULL, finalized_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (organization_id,document_id) REFERENCES knowledge.documents(organization_id,id),
 UNIQUE (organization_id,id), UNIQUE (organization_id,document_id,version), UNIQUE (organization_id,storage_key),
 CHECK (size_bytes > 0), CHECK (length(original_filename) BETWEEN 1 AND 255), CHECK (storage_version_id IS NULL OR finalized_at IS NOT NULL));
CREATE TABLE knowledge.resource_grants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, resource_type text NOT NULL CHECK (resource_type IN ('knowledge_base','document')),
 resource_id uuid NOT NULL, membership_id uuid NOT NULL, action text NOT NULL CHECK (action IN ('read','ingest','manage')),
 created_by_membership_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organization_id,resource_type,resource_id,membership_id,action));
CREATE TABLE knowledge.upload_idempotency (
 organization_id uuid NOT NULL, membership_id uuid NOT NULL, idempotency_key text NOT NULL, request_fingerprint text NOT NULL,
 document_version_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (organization_id,membership_id,idempotency_key),
 FOREIGN KEY (organization_id,document_version_id) REFERENCES knowledge.document_versions(organization_id,id), CHECK (length(idempotency_key) BETWEEN 1 AND 128));
CREATE TABLE knowledge.ingestion_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, document_version_id uuid NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','cancelled')),
 requested_by_membership_id uuid NOT NULL, correlation_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organization_id,document_version_id), FOREIGN KEY (organization_id,document_version_id) REFERENCES knowledge.document_versions(organization_id,id));
CREATE TABLE knowledge.audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, actor_membership_id uuid NOT NULL, action text NOT NULL,
 resource_type text NOT NULL, resource_id uuid NOT NULL, request_id text NOT NULL, correlation_id text NOT NULL,
 metadata jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'), created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX knowledge_bases_org_idx ON knowledge.knowledge_bases(organization_id,id);
CREATE INDEX knowledge_sources_org_base_idx ON knowledge.knowledge_sources(organization_id,knowledge_base_id,id);
CREATE INDEX documents_org_base_idx ON knowledge.documents(organization_id,knowledge_base_id,id);
CREATE INDEX document_versions_org_doc_idx ON knowledge.document_versions(organization_id,document_id,version DESC);
CREATE INDEX resource_grants_lookup_idx ON knowledge.resource_grants(organization_id,resource_type,resource_id,membership_id,action);
CREATE INDEX ingestion_requests_pending_idx ON knowledge.ingestion_requests(organization_id,status,created_at);
CREATE INDEX knowledge_audit_org_time_idx ON knowledge.audit_events(organization_id,created_at DESC,id);
