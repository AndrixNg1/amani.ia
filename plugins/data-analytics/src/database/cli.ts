import 'reflect-metadata';
import { loadLocalEnvironment } from '../common/config';
import { DatabaseService } from './database';
import { migrateInTransaction } from './migrate';

async function main() {
  loadLocalEnvironment();
  if (process.argv[2] !== 'migrate') throw new Error('Usage: db:migrate');
  const database = new DatabaseService();
  try {
    await database.transaction(migrateInTransaction);
  } finally {
    await database.onApplicationShutdown();
  }
}
void main().catch(() => {
  console.error(
    'Data Analytics database command failed. Check configuration and database state.',
  );
  process.exitCode = 1;
});
