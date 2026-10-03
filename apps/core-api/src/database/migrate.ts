import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import type { Session } from './database';
import { verifyDatabaseIdentity } from './database';

// Ordered, reviewed list. No schema creation, ORM push/sync or automatic startup migration.
export const migrationFiles = ['0001_core_platform.sql'] as const;
export async function migrateInTransaction(db: Session) {
  await verifyDatabaseIdentity(db);
  await db.execute(sql`SELECT pg_catalog.pg_advisory_xact_lock(704001)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS core_platform.schema_migrations (
    name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  for (const file of migrationFiles) {
    const source = readFileSync(
      resolve(process.cwd(), 'migrations', file),
      'utf8',
    );
    const checksum = createHash('sha256').update(source).digest('hex');
    const applied = await db.execute<{ checksum: string }>(
      sql`SELECT checksum FROM core_platform.schema_migrations WHERE name = ${file}`,
    );
    if (applied.rows.length) {
      if (applied.rows[0].checksum !== checksum)
        throw new Error('Applied migration checksum differs');
      continue;
    }
    // Trusted checked-in SQL only. No user/config value is interpolated into raw SQL.
    await db.execute(sql.raw(source));
    await db.execute(
      sql`INSERT INTO core_platform.schema_migrations(name,checksum) VALUES (${file},${checksum})`,
    );
  }
}
