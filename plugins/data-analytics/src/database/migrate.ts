import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import type { Session } from './database';
import { verifyDatabaseIdentity } from './database';

export const migrationFiles = ['0001_data_analytics.sql'] as const;
export async function migrateInTransaction(db: Session) {
  await verifyDatabaseIdentity(db);
  await db.execute(sql`SELECT pg_catalog.pg_advisory_xact_lock(709001)`);
  await db.execute(
    sql`CREATE TABLE IF NOT EXISTS data_analytics.schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`,
  );
  for (const file of migrationFiles) {
    const source = readFileSync(
      resolve(process.cwd(), 'migrations', file),
      'utf8',
    );
    const checksum = createHash('sha256').update(source).digest('hex');
    const current = await db.execute<{ checksum: string }>(
      sql`SELECT checksum FROM data_analytics.schema_migrations WHERE name=${file}`,
    );
    if (current.rows.length) {
      if (current.rows[0].checksum !== checksum)
        throw new Error('Applied migration checksum differs');
      continue;
    }
    await db.execute(sql.raw(source));
    await db.execute(
      sql`INSERT INTO data_analytics.schema_migrations(name,checksum) VALUES(${file},${checksum})`,
    );
  }
}
