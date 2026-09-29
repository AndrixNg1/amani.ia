-- Invoked by 002-service-isolation.sh in one transaction, never directly by entrypoint.
\set ON_ERROR_STOP on
\set ECHO none
\getenv bootstrap_database POSTGRES_DB
SET LOCAL search_path = pg_catalog;
SET LOCAL password_encryption = 'scram-sha-256';
-- Avoid credentials in SQL statement logging, including failed generated statements.
SET LOCAL log_statement = 'none';
SET LOCAL log_min_duration_statement = -1;
SET LOCAL log_min_error_statement = 'panic';

REVOKE ALL ON DATABASE :"bootstrap_database" FROM PUBLIC;
REVOKE ALL ON DATABASE postgres, template1 FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER DATABASE :"bootstrap_database" SET search_path TO pg_catalog;

\set service_role amani_core_platform
\set service_schema core_platform
\getenv service_password CORE_PLATFORM_DB_PASSWORD
\ir service.sql
\set service_role amani_knowledge
\set service_schema knowledge
\getenv service_password KNOWLEDGE_DB_PASSWORD
\ir service.sql
\set service_role amani_data_analytics
\set service_schema data_analytics
\getenv service_password DATA_ANALYTICS_DB_PASSWORD
\ir service.sql
\set service_role amani_conversations
\set service_schema conversations
\getenv service_password CONVERSATIONS_DB_PASSWORD
\ir service.sql
\set service_role amani_connectors
\set service_schema connectors
\getenv service_password CONNECTORS_DB_PASSWORD
\ir service.sql
\set service_role amani_evaluation
\set service_schema evaluation
\getenv service_password EVALUATION_DB_PASSWORD
\ir service.sql
\unset service_password

-- Extension code/types remain admin-owned; only Knowledge can resolve/use them.
GRANT USAGE ON SCHEMA extensions TO amani_knowledge;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO amani_knowledge;
GRANT USAGE ON TYPE extensions.vector, extensions.halfvec, extensions.sparsevec TO amani_knowledge;
ALTER ROLE amani_knowledge IN DATABASE :"bootstrap_database" SET search_path TO knowledge, extensions;

-- Fail rather than silently adopt existing roles with foreign memberships or access.
DO $$
DECLARE
  service text;
  other_schema text;
  role_record record;
  services text[] := ARRAY['core_platform', 'knowledge', 'data_analytics', 'conversations', 'connectors', 'evaluation'];
BEGIN
  FOREACH service IN ARRAY services LOOP
    SELECT * INTO STRICT role_record FROM pg_roles WHERE rolname = 'amani_' || service;
    IF role_record.rolsuper OR role_record.rolcreatedb OR role_record.rolcreaterole
       OR role_record.rolreplication OR role_record.rolbypassrls OR NOT role_record.rolcanlogin
       OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member = role_record.oid OR roleid = role_record.oid)
    THEN
      RAISE EXCEPTION 'Unexpected privileges or membership on a service role';
    END IF;
    FOREACH other_schema IN ARRAY services LOOP
      IF service <> other_schema AND (
        has_schema_privilege(role_record.oid, other_schema, 'USAGE')
        OR has_schema_privilege(role_record.oid, other_schema, 'CREATE')
      ) THEN
        RAISE EXCEPTION 'Cross-service schema privilege found';
      END IF;
    END LOOP;
    IF has_database_privilege(role_record.oid, current_database(), 'CREATE')
       OR has_database_privilege(role_record.oid, current_database(), 'TEMPORARY')
       OR has_schema_privilege(role_record.oid, 'public', 'USAGE')
       OR has_schema_privilege(role_record.oid, 'public', 'CREATE')
       OR has_schema_privilege(role_record.oid, 'extensions', 'CREATE')
       OR (service <> 'knowledge' AND has_schema_privilege(role_record.oid, 'extensions', 'USAGE'))
    THEN
      RAISE EXCEPTION 'Service role has unexpected database/public/extension privileges';
    END IF;
  END LOOP;
END
$$;
