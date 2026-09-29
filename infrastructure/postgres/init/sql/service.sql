-- psql literal/identifier quoting handles punctuation in passwords safely.
-- Existing passwords are deliberately NOT reset on an explicit reviewed replay.
SELECT format(
  'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
  :'service_role', :'service_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'service_role')
\gexec

SELECT format('CREATE SCHEMA %I AUTHORIZATION %I', :'service_schema', :'service_role')
WHERE NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = :'service_schema')
\gexec

-- Refuse a pre-existing schema owned by another role. Never reassign it silently.
SELECT n.nspowner = r.oid AS schema_owner_matches
FROM pg_namespace n CROSS JOIN pg_roles r
WHERE n.nspname = :'service_schema' AND r.rolname = :'service_role'
\gset
\if :schema_owner_matches
\else
  DO $$ BEGIN RAISE EXCEPTION 'Unexpected service schema owner'; END $$;
\endif

REVOKE ALL ON SCHEMA :"service_schema" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"bootstrap_database" TO :"service_role";
ALTER ROLE :"service_role" IN DATABASE :"bootstrap_database" SET search_path TO :"service_schema";

-- Global per-creator defaults: a per-schema REVOKE cannot undo PUBLIC defaults.
ALTER DEFAULT PRIVILEGES FOR ROLE :"service_role" REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE :"service_role" REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE :"service_role" REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE :"service_role" REVOKE USAGE ON TYPES FROM PUBLIC;
