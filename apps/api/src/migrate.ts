import { createDatabasePool, loadMigrationDatabaseConfig } from './database.ts';
import { runMigrations } from './migrations.ts';

const config = loadMigrationDatabaseConfig(process.env);
const pool = createDatabasePool(config, 'align-migrate');

try {
  const result = await runMigrations({
    pool,
    expectedIdentity: config.expectedIdentity,
    migrationsDirectory: new URL('../migrations/', import.meta.url),
  });
  process.stdout.write(
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      service: 'migrate',
      environment: config.expectedIdentity.environment,
      databaseName: config.expectedIdentity.databaseName,
      event: 'migration_complete',
      applied: result.applied,
      skipped: result.skipped,
    })}\n`,
  );
} catch {
  process.stderr.write(
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      service: 'migrate',
      environment: config.expectedIdentity.environment,
      databaseName: config.expectedIdentity.databaseName,
      event: 'migration_failed',
      errorCode: 'migration_failed',
    })}\n`,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
