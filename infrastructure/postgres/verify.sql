\set ON_ERROR_STOP on
BEGIN READ ONLY;
SET LOCAL search_path = pg_catalog;

DO $$
DECLARE
  service text;
  other_schema text;
  role_record record;
  services text[] := ARRAY['core_platform', 'knowledge', 'data_analytics', 'conversations', 'connectors', 'evaluation'];
  object_kind "char";
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
    JOIN pg_roles owner ON owner.oid = e.extowner
    WHERE e.extname = 'vector' AND e.extversion = '0.8.6'
      AND n.nspname = 'extensions' AND owner.rolsuper AND n.nspowner = owner.oid
  ) THEN
    RAISE EXCEPTION 'FAIL: expected admin-owned pgvector 0.8.6 in extensions';
  END IF;

  FOREACH service IN ARRAY services LOOP
    SELECT * INTO STRICT role_record FROM pg_roles WHERE rolname = 'amani_' || service;
    IF role_record.rolsuper OR role_record.rolcreatedb OR role_record.rolcreaterole
       OR role_record.rolreplication OR role_record.rolbypassrls OR NOT role_record.rolcanlogin
       OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member = role_record.oid OR roleid = role_record.oid)
    THEN
      RAISE EXCEPTION 'FAIL: unexpected service role privileges/memberships';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_authid WHERE oid = role_record.oid AND rolpassword LIKE 'SCRAM-SHA-256$%'
    ) THEN
      RAISE EXCEPTION 'FAIL: missing SCRAM service password';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_namespace WHERE nspname = service AND nspowner = role_record.oid
    ) THEN
      RAISE EXCEPTION 'FAIL: incorrect schema ownership';
    END IF;

    FOREACH other_schema IN ARRAY services LOOP
      IF has_schema_privilege(role_record.oid, other_schema, 'USAGE') <> (service = other_schema)
         OR has_schema_privilege(role_record.oid, other_schema, 'CREATE') <> (service = other_schema)
      THEN
        RAISE EXCEPTION 'FAIL: service schema isolation';
      END IF;
    END LOOP;
    IF NOT has_database_privilege(role_record.oid, current_database(), 'CONNECT')
       OR has_database_privilege(role_record.oid, current_database(), 'CREATE')
       OR has_database_privilege(role_record.oid, current_database(), 'TEMPORARY')
       OR has_database_privilege(role_record.oid, 'postgres', 'CONNECT')
       OR has_database_privilege(role_record.oid, 'template1', 'CONNECT')
       OR has_schema_privilege(role_record.oid, 'public', 'USAGE')
       OR has_schema_privilege(role_record.oid, 'public', 'CREATE')
       OR has_schema_privilege(role_record.oid, 'extensions', 'CREATE')
       OR has_schema_privilege(role_record.oid, 'extensions', 'USAGE') <> (service = 'knowledge')
       OR has_type_privilege(role_record.oid, 'extensions.vector', 'USAGE') <> (service = 'knowledge')
    THEN
      RAISE EXCEPTION 'FAIL: unexpected database/public/extension privileges';
    END IF;

    -- Default PUBLIC grants on functions/types must be revoked globally per creator.
    FOREACH object_kind IN ARRAY ARRAY['f'::"char", 'T'::"char"] LOOP
      IF EXISTS (
        SELECT 1 FROM aclexplode(COALESCE(
          (SELECT defaclacl FROM pg_default_acl
           WHERE defaclrole = role_record.oid AND defaclnamespace = 0 AND defaclobjtype = object_kind),
          acldefault(object_kind, role_record.oid)
        )) a WHERE a.grantee = 0
      ) THEN
        RAISE EXCEPTION 'FAIL: PUBLIC default function/type privileges remain';
      END IF;
    END LOOP;
    IF EXISTS (
      SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
      WHERE d.defaclrole = role_record.oid AND a.grantee <> role_record.oid
    ) THEN
      RAISE EXCEPTION 'FAIL: default grants to another role or PUBLIC';
    END IF;
  END LOOP;
END
$$;

SELECT 'PASS: six service roles, schema isolation, default privileges and pgvector.' AS result;
SELECT extname, extversion, n.nspname AS extension_schema
FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE extname = 'vector';
SELECT n.nspname AS schema, r.rolname AS owner
FROM pg_namespace n JOIN pg_roles r ON r.oid = n.nspowner
WHERE n.nspname IN ('core_platform','knowledge','data_analytics','conversations','connectors','evaluation')
ORDER BY n.nspname;
COMMIT;
