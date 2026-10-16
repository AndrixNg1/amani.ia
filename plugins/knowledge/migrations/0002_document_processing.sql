-- Run only as amani_knowledge. Knowledge owns processing metadata and vectors.
ALTER TABLE knowledge.ingestion_requests
  ADD CONSTRAINT ingestion_requests_organization_id_id_key UNIQUE (organization_id, id);

CREATE TABLE knowledge.document_processing_outbox (
  job_id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  document_version_id uuid NOT NULL,
  requested_by_user_id uuid NOT NULL,
  correlation_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published')),
  publish_attempts integer NOT NULL DEFAULT 0 CHECK (publish_attempts >= 0),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, document_version_id)
    REFERENCES knowledge.document_versions(organization_id, id),
  FOREIGN KEY (organization_id, job_id)
    REFERENCES knowledge.ingestion_requests(organization_id, id)
);

CREATE TABLE knowledge.document_processing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  document_version_id uuid NOT NULL,
  ingestion_request_id uuid NOT NULL,
  job_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing','completed','failed')),
  extraction_version integer NOT NULL DEFAULT 1 CHECK (extraction_version > 0),
  normalization_version integer NOT NULL CHECK (normalization_version > 0),
  chunking_version integer NOT NULL CHECK (chunking_version > 0),
  chunk_size integer NOT NULL CHECK (chunk_size > 0),
  chunk_overlap integer NOT NULL CHECK (chunk_overlap >= 0 AND chunk_overlap < chunk_size),
  embedding_provider text NOT NULL CHECK (length(embedding_provider) BETWEEN 1 AND 120),
  embedding_model text NOT NULL CHECK (length(embedding_model) BETWEEN 1 AND 200),
  embedding_dimension integer NOT NULL CHECK (embedding_dimension > 0),
  embedding_config_version integer NOT NULL CHECK (embedding_config_version > 0),
  expected_chunk_count integer CHECK (expected_chunk_count >= 0),
  persisted_chunk_count integer NOT NULL DEFAULT 0 CHECK (persisted_chunk_count >= 0),
  failure_code text,
  failure_message_safe text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, document_version_id)
    REFERENCES knowledge.document_versions(organization_id, id),
  FOREIGN KEY (organization_id, ingestion_request_id)
    REFERENCES knowledge.ingestion_requests(organization_id, id),
  UNIQUE (organization_id, document_version_id),
  UNIQUE (organization_id, job_id),
  CHECK (
    (status = 'completed' AND completed_at IS NOT NULL AND failure_code IS NULL)
    OR (status = 'failed' AND failure_code IS NOT NULL)
    OR status = 'processing'
  )
);

CREATE TABLE knowledge.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  knowledge_base_id uuid NOT NULL,
  source_id uuid NOT NULL,
  document_id uuid NOT NULL,
  document_version_id uuid NOT NULL,
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  content text NOT NULL CHECK (length(content) > 0),
  content_checksum text NOT NULL CHECK (content_checksum ~ '^[a-f0-9]{64}$'),
  section_reference text,
  page_number integer CHECK (page_number > 0),
  embedding extensions.vector NOT NULL,
  embedding_provider text NOT NULL CHECK (length(embedding_provider) BETWEEN 1 AND 120),
  embedding_model text NOT NULL CHECK (length(embedding_model) BETWEEN 1 AND 200),
  embedding_dimension integer NOT NULL CHECK (embedding_dimension > 0),
  embedding_config_version integer NOT NULL CHECK (embedding_config_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, knowledge_base_id)
    REFERENCES knowledge.knowledge_bases(organization_id, id),
  FOREIGN KEY (organization_id, source_id, knowledge_base_id)
    REFERENCES knowledge.knowledge_sources(organization_id, id, knowledge_base_id),
  FOREIGN KEY (organization_id, document_id)
    REFERENCES knowledge.documents(organization_id, id),
  FOREIGN KEY (organization_id, document_version_id)
    REFERENCES knowledge.document_versions(organization_id, id),
  UNIQUE (organization_id, document_version_id, chunk_index),
  CHECK (extensions.vector_dims(embedding) = embedding_dimension)
);

CREATE INDEX document_processing_outbox_pending_idx
  ON knowledge.document_processing_outbox (status, created_at, job_id);
CREATE INDEX document_processing_runs_org_version_idx
  ON knowledge.document_processing_runs (organization_id, document_version_id, status);
CREATE INDEX document_chunks_org_version_idx
  ON knowledge.document_chunks (organization_id, document_version_id, chunk_index);
CREATE INDEX document_chunks_org_document_idx
  ON knowledge.document_chunks (organization_id, document_id, chunk_index);
