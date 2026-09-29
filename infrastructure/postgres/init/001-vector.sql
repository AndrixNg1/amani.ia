-- Fresh-volume bootstrap only. No business tables or embeddings are created.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path = pg_catalog;
CREATE SCHEMA IF NOT EXISTS extensions;
REVOKE ALL ON SCHEMA extensions FROM PUBLIC;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Existing public.vector from Phase 0 needs an explicit, reviewed migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'vector' AND n.nspname = 'extensions'
      AND n.nspowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
      AND e.extowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
  ) THEN
    RAISE EXCEPTION 'Unexpected pgvector location or owner; review the existing database before bootstrap';
  END IF;
END
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA extensions FROM PUBLIC;
REVOKE ALL ON TYPE extensions.vector, extensions.halfvec, extensions.sparsevec FROM PUBLIC;
COMMIT;
