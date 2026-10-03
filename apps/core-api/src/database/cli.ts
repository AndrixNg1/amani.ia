import 'reflect-metadata';
import { coreConfig, loadLocalEnvironment } from '../common/config';
import { DatabaseService } from './database';
import { migrateInTransaction } from './migrate';
import { seedDevelopment } from './seed';

async function main() {
  loadLocalEnvironment();
  const command = process.argv[2];
  if (command !== 'migrate' && command !== 'seed')
    throw new Error('Unsupported command');
  const config = coreConfig();
  if (
    command === 'seed' &&
    !['development', 'test'].includes(config.environment)
  )
    throw new Error('Development seed refused');
  const database = new DatabaseService();
  try {
    await database.transaction(async (tx) => {
      if (command === 'migrate') await migrateInTransaction(tx);
      else await seedDevelopment(tx);
    });
    console.log(`Core ${command} completed as amani_core_platform.`);
  } finally {
    await database.onApplicationShutdown();
  }
}
void main().catch(() => {
  console.error(
    'Core database command failed. Check configuration, service credentials and migration state before retrying.',
  );
  process.exitCode = 1;
});
