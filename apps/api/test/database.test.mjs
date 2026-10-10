import assert from 'node:assert/strict';
import test from 'node:test';

async function loadDatabaseModule() {
  try {
    return await import('../src/database.ts');
  } catch (error) {
    assert.fail(`database module must exist: ${error.code ?? error.message}`);
  }
}

test('loadRuntimeDatabaseConfig requires a PostgreSQL URL and database identity', async () => {
  const { loadRuntimeDatabaseConfig } = await loadDatabaseModule();
  const config = loadRuntimeDatabaseConfig({
    APP_ENV: 'staging',
    EXPECTED_DATABASE_NAME: 'align_staging',
    DATABASE_URL: 'postgresql://runtime:placeholder@db:5432/align_staging',
  });

  assert.deepEqual(config, {
    connectionString: 'postgresql://runtime:placeholder@db:5432/align_staging',
    expectedIdentity: { environment: 'staging', databaseName: 'align_staging' },
  });
  assert.throws(
    () =>
      loadRuntimeDatabaseConfig({
        APP_ENV: 'staging',
        EXPECTED_DATABASE_NAME: 'align_staging',
        DATABASE_URL: 'file:./align.db',
      }),
    /DATABASE_URL/,
  );
});

test('loadMigrationDatabaseConfig requires the dedicated migration URL', async () => {
  const { loadMigrationDatabaseConfig } = await loadDatabaseModule();

  assert.throws(
    () =>
      loadMigrationDatabaseConfig({
        APP_ENV: 'production',
        EXPECTED_DATABASE_NAME: 'align_production',
      }),
    /MIGRATION_DATABASE_URL/,
  );
});

test('database configuration accepts discrete fields without URL-encoding passwords', async () => {
  const { loadRuntimeDatabaseConfig, loadMigrationDatabaseConfig } = await loadDatabaseModule();
  const common = {
    APP_ENV: 'production',
    EXPECTED_DATABASE_NAME: 'align_production',
    DATABASE_HOST: 'db',
    DATABASE_PORT: '5432',
    DATABASE_NAME: 'align_production',
  };

  assert.deepEqual(
    loadRuntimeDatabaseConfig({
      ...common,
      DATABASE_RUNTIME_USER: 'align_app',
      DATABASE_RUNTIME_PASSWORD: 'reserved:/?#[]@ value',
    }).connection,
    {
      host: 'db',
      port: 5432,
      database: 'align_production',
      user: 'align_app',
      password: 'reserved:/?#[]@ value',
    },
  );
  assert.deepEqual(
    loadMigrationDatabaseConfig({
      ...common,
      DATABASE_MIGRATION_USER: 'align_migrator',
      DATABASE_MIGRATION_PASSWORD: 'another:/?#[]@ value',
    }).connection,
    {
      host: 'db',
      port: 5432,
      database: 'align_production',
      user: 'align_migrator',
      password: 'another:/?#[]@ value',
    },
  );
});
