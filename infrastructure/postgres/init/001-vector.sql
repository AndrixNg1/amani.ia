-- Runs once for a new PostgreSQL data volume, in POSTGRES_DB.
-- Application tables, roles and tenant policies require future migrations.
CREATE EXTENSION IF NOT EXISTS vector;
