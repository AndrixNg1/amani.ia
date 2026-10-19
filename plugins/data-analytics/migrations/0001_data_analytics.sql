-- Run only as amani_data_analytics. All resource links are tenant-scoped; Core IDs remain opaque.
CREATE TABLE data_analytics.data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('manual_upload','connector')),
  provider text NOT NULL CHECK (provider IN ('csv','xlsx','postgresql','mysql','sqlserver','warehouse','other')),
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 120),
  connector_reference text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','archived')),
  created_by_membership_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  CHECK ((source_kind='manual_upload' AND provider IN ('csv','xlsx') AND connector_reference IS NULL) OR
         (source_kind='connector' AND provider NOT IN ('csv','xlsx') AND connector_reference IS NOT NULL AND length(connector_reference) BETWEEN 1 AND 255))
);
CREATE INDEX data_sources_org_status_idx ON data_analytics.data_sources(organization_id,status,created_at DESC);
CREATE TABLE data_analytics.datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, source_id uuid NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120), description text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','ready','failed','archived')),
  created_by_membership_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,source_id) REFERENCES data_analytics.data_sources(organization_id,id),
  UNIQUE (organization_id,id), UNIQUE (organization_id,source_id,name)
);
CREATE INDEX datasets_org_status_idx ON data_analytics.datasets(organization_id,status,created_at DESC);
CREATE TABLE data_analytics.dataset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, dataset_id uuid NOT NULL, version integer NOT NULL CHECK (version > 0),
  original_filename text, mime_type text, size_bytes integer CHECK (size_bytes > 0), checksum_sha256 text,
  storage_bucket text, storage_key text, storage_version_id text,
  import_status text NOT NULL DEFAULT 'awaiting_upload' CHECK (import_status IN ('awaiting_upload','pending','processing','ready','failed','cancelled')),
  created_by_membership_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,dataset_id) REFERENCES data_analytics.datasets(organization_id,id),
  UNIQUE (organization_id,id), UNIQUE (organization_id,dataset_id,version), UNIQUE (organization_id,id,dataset_id),
  CHECK ((storage_bucket IS NULL AND storage_key IS NULL AND storage_version_id IS NULL AND original_filename IS NULL AND mime_type IS NULL AND size_bytes IS NULL) OR
         (storage_bucket IS NOT NULL AND storage_key IS NOT NULL AND original_filename IS NOT NULL AND mime_type IS NOT NULL AND size_bytes IS NOT NULL)),
  CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[a-f0-9]{64}$')
);
CREATE INDEX dataset_versions_org_dataset_idx ON data_analytics.dataset_versions(organization_id,dataset_id,version DESC);
CREATE TABLE data_analytics.dataset_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, dataset_id uuid NOT NULL, dataset_version_id uuid NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 255), display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 255),
  ordinal integer NOT NULL CHECK (ordinal >= 0), row_count integer CHECK (row_count >= 0),
  metadata_status text NOT NULL DEFAULT 'pending' CHECK (metadata_status IN ('pending','ready','failed')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,dataset_id) REFERENCES data_analytics.datasets(organization_id,id),
  FOREIGN KEY (organization_id,dataset_version_id,dataset_id) REFERENCES data_analytics.dataset_versions(organization_id,id,dataset_id),
  UNIQUE (organization_id,id), UNIQUE (organization_id,dataset_version_id,name), UNIQUE (organization_id,dataset_version_id,ordinal)
);
CREATE TABLE data_analytics.dataset_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, table_id uuid NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 255), ordinal integer NOT NULL CHECK (ordinal >= 0),
  logical_type text NOT NULL CHECK (logical_type IN ('string','integer','decimal','boolean','date','datetime','categorical','unknown')),
  nullable text NOT NULL DEFAULT 'unknown' CHECK (nullable IN ('yes','no','unknown')),
  security_classification text NOT NULL DEFAULT 'none' CHECK (security_classification IN ('none','sensitive','personal','financial','confidential')),
  visibility text NOT NULL DEFAULT 'inherit' CHECK (visibility IN ('inherit','restricted')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,table_id) REFERENCES data_analytics.dataset_tables(organization_id,id),
  UNIQUE (organization_id,id), UNIQUE (organization_id,table_id,name), UNIQUE (organization_id,table_id,ordinal)
);
CREATE TABLE data_analytics.resource_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('dataset','dataset_table','dataset_column')),
  resource_id uuid NOT NULL, subject_type text NOT NULL CHECK (subject_type IN ('membership','team','role')),
  subject_id uuid NOT NULL, action text NOT NULL CHECK (action IN ('read','analyze','manage')),
  created_by_membership_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id), UNIQUE (organization_id,resource_type,resource_id,subject_type,subject_id,action)
);
CREATE INDEX resource_grants_membership_idx ON data_analytics.resource_grants(organization_id,subject_type,subject_id,action,resource_type,resource_id);
CREATE TABLE data_analytics.upload_idempotency (
  organization_id uuid NOT NULL, membership_id uuid NOT NULL, idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'), dataset_version_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (organization_id,membership_id,idempotency_key),
  FOREIGN KEY (organization_id,dataset_version_id) REFERENCES data_analytics.dataset_versions(organization_id,id)
);
CREATE TABLE data_analytics.analysis_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, dataset_id uuid NOT NULL, dataset_version_id uuid NOT NULL,
  requested_by_membership_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('profile','describe','aggregate','group','filter','correlation','chart_data')),
  parameters jsonb NOT NULL CHECK (jsonb_typeof(parameters)='object'), scope jsonb NOT NULL CHECK (jsonb_typeof(scope)='object'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','ready','failed','cancelled')),
  correlation_id text NOT NULL CHECK (length(correlation_id) BETWEEN 1 AND 128), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,dataset_id) REFERENCES data_analytics.datasets(organization_id,id),
  FOREIGN KEY (organization_id,dataset_version_id,dataset_id) REFERENCES data_analytics.dataset_versions(organization_id,id,dataset_id),
  UNIQUE (organization_id,id)
);
CREATE INDEX analysis_requests_org_dataset_idx ON data_analytics.analysis_requests(organization_id,dataset_id,created_at DESC);
CREATE TABLE data_analytics.analysis_request_idempotency (
  organization_id uuid NOT NULL, membership_id uuid NOT NULL, idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'), analysis_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (organization_id,membership_id,idempotency_key),
  FOREIGN KEY (organization_id,analysis_request_id) REFERENCES data_analytics.analysis_requests(organization_id,id)
);
CREATE TABLE data_analytics.analysis_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, analysis_request_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','failed','expired')),
  result_type text NOT NULL CHECK (result_type IN ('metadata','table','chart_data','artifact')),
  artifact_reference text, summary_metadata jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(summary_metadata)='object'),
  expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,analysis_request_id) REFERENCES data_analytics.analysis_requests(organization_id,id),
  UNIQUE (organization_id,id)
);
CREATE INDEX analysis_results_org_request_idx ON data_analytics.analysis_results(organization_id,analysis_request_id,created_at DESC);
