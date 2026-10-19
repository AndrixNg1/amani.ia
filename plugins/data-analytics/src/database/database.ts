import { Injectable, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { analyticsConfig } from '../common/config';

export type Database = NodePgDatabase;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type Session = Database | Transaction;

export async function verifyDatabaseIdentity(db: Session) {
  const result = await db.execute<{ valid: boolean }>(sql`
    SELECT current_user = 'amani_data_analytics' AND current_schema() = 'data_analytics'
      AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AS valid
    FROM pg_catalog.pg_roles WHERE rolname = current_user`);
  if (result.rows[0]?.valid !== true)
    throw new Error('Invalid Data Analytics database identity');
}

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  readonly pool = new Pool(analyticsConfig().database);
  readonly db: Database = drizzle(this.pool, { logger: false });
  constructor() {
    this.pool.on('error', () =>
      console.error('Data Analytics database connection lost'),
    );
  }
  async transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await verifyDatabaseIdentity(tx);
      return work(tx);
    });
  }
  async ready() {
    await verifyDatabaseIdentity(this.db);
    await this.db.execute(sql`SELECT id FROM data_analytics.datasets LIMIT 0`);
  }
  async onApplicationShutdown() {
    await this.pool.end();
  }
}
@Module({ providers: [DatabaseService], exports: [DatabaseService] })
export class DatabaseModule {}
