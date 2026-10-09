import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import pg from 'pg';

import { createReadinessProbe } from '../../src/database.ts';
import { runMigrations } from '../../src/migrations.ts';

const migrationDatabaseUrl = process.env.TEST_MIGRATION_DATABASE_URL;
const runtimeDatabaseUrl = process.env.TEST_RUNTIME_DATABASE_URL;

if (!migrationDatabaseUrl || !runtimeDatabaseUrl) {
  throw new Error(
    'TEST_MIGRATION_DATABASE_URL and TEST_RUNTIME_DATABASE_URL are required for integration tests',
  );
}

const { Pool } = pg;
const migrationPool = new Pool({ connectionString: migrationDatabaseUrl, max: 4 });
const runtimePool = new Pool({ connectionString: runtimeDatabaseUrl, max: 2 });
const expectedIdentity = { environment: 'test', databaseName: 'align_test' };
const migrationsDirectory = new URL('../../migrations/', import.meta.url);

test.before(async () => {
  await migrationPool.query('DROP SCHEMA IF EXISTS align CASCADE');
});

test.after(async () => {
  await runtimePool.end();
  await migrationPool.end();
});

test('migration and runtime identities are non-superuser roles', async () => {
  const migrationRole = await migrationPool.query(
    'SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user',
  );
  const runtimeRole = await runtimePool.query(
    'SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user',
  );

  assert.deepEqual(migrationRole.rows, [
    { rolsuper: false, rolcreatedb: false, rolcreaterole: false },
  ]);
  assert.deepEqual(runtimeRole.rows, [
    { rolsuper: false, rolcreatedb: false, rolcreaterole: false },
  ]);
});

test('fresh and repeated migrations are deterministic', async () => {
  const first = await runMigrations({
    pool: migrationPool,
    expectedIdentity,
    migrationsDirectory,
  });
  const second = await runMigrations({
    pool: migrationPool,
    expectedIdentity,
    migrationsDirectory,
  });
  const history = await migrationPool.query(
    'SELECT version, name FROM align.schema_migrations ORDER BY version',
  );

  assert.deepEqual(first, { applied: ['0001'], skipped: [] });
  assert.deepEqual(second, { applied: [], skipped: ['0001'] });
  assert.deepEqual(history.rows, [{ version: '0001', name: 'platform_baseline' }]);
});

test('an existing previous schema upgrades without losing its records', async () => {
  await migrationPool.query('DROP SCHEMA IF EXISTS align CASCADE');
  await migrationPool.query(`
    CREATE SCHEMA align;
    CREATE TABLE align.schema_migrations (
      version text PRIMARY KEY,
      name text NOT NULL,
      checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
      applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );
    INSERT INTO align.schema_migrations(version, name, checksum)
    VALUES ('0000', 'legacy_baseline', repeat('0', 64));
    CREATE TABLE align.legacy_record(id integer PRIMARY KEY, label text NOT NULL);
    INSERT INTO align.legacy_record(id, label) VALUES (1, 'preserve-me');
  `);

  const result = await runMigrations({
    pool: migrationPool,
    expectedIdentity,
    migrationsDirectory,
  });
  const legacy = await migrationPool.query('SELECT id, label FROM align.legacy_record');
  const history = await migrationPool.query(
    'SELECT version FROM align.schema_migrations ORDER BY version',
  );

  assert.deepEqual(result, { applied: ['0001'], skipped: [] });
  assert.deepEqual(legacy.rows, [{ id: 1, label: 'preserve-me' }]);
  assert.deepEqual(history.rows, [{ version: '0000' }, { version: '0001' }]);
});

test('readiness verifies database identity and reports the latest migration', async () => {
  const readiness = createReadinessProbe(migrationPool, expectedIdentity);

  assert.deepEqual(await readiness(), { schemaVersion: '0001' });
});

test('a failing migration rolls back its schema changes and history record', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'align-failing-migrations-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, '0001_platform_baseline.sql'), 'SELECT 1;\n');
  await writeFile(
    join(directory, '0002_expected_failure.sql'),
    'CREATE TABLE align.must_rollback(id integer); SELECT * FROM missing_relation;\n',
  );

  await migrationPool.query('DROP SCHEMA IF EXISTS align CASCADE');
  await assert.rejects(
    runMigrations({ pool: migrationPool, expectedIdentity, migrationsDirectory: directory }),
    /missing_relation/,
  );

  const table = await migrationPool.query("SELECT to_regclass('align.must_rollback') AS name");
  const history = await migrationPool.query(
    "SELECT count(*)::integer AS count FROM align.schema_migrations WHERE version = '0002'",
  );
  assert.equal(table.rows[0].name, null);
  assert.equal(history.rows[0].count, 0);
});

test('the wrong environment aborts before creating migration schema', async () => {
  await migrationPool.query('DROP SCHEMA IF EXISTS align CASCADE');

  await assert.rejects(
    runMigrations({
      pool: migrationPool,
      expectedIdentity: { environment: 'production', databaseName: 'align_production' },
      migrationsDirectory,
    }),
    /Database identity mismatch/,
  );

  const schema = await migrationPool.query(
    "SELECT count(*)::integer AS count FROM information_schema.schemata WHERE schema_name = 'align'",
  );
  assert.equal(schema.rows[0].count, 0);
});

test('the advisory lock serializes concurrent migration attempts', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'align-concurrent-migrations-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(
    join(directory, '0001_slow_baseline.sql'),
    'SELECT pg_sleep(0.15); CREATE TABLE align.concurrent_marker(id integer PRIMARY KEY);\n',
  );
  await migrationPool.query('DROP SCHEMA IF EXISTS align CASCADE');

  const results = await Promise.all([
    runMigrations({ pool: migrationPool, expectedIdentity, migrationsDirectory: directory }),
    runMigrations({ pool: migrationPool, expectedIdentity, migrationsDirectory: directory }),
  ]);

  assert.deepEqual(
    results.sort((left, right) => right.applied.length - left.applied.length),
    [
      { applied: ['0001'], skipped: [] },
      { applied: [], skipped: ['0001'] },
    ],
  );
});

test('the runtime role can read but cannot alter the application schema', async () => {
  await migrationPool.query('DROP SCHEMA IF EXISTS align CASCADE');
  await runMigrations({ pool: migrationPool, expectedIdentity, migrationsDirectory });
  await migrationPool.query('GRANT USAGE ON SCHEMA align TO align_test_app');
  await migrationPool.query('GRANT SELECT ON ALL TABLES IN SCHEMA align TO align_test_app');

  const result = await runtimePool.query('SELECT version FROM align.schema_migrations');
  assert.deepEqual(result.rows, [{ version: '0001' }]);
  await assert.rejects(
    runtimePool.query('CREATE TABLE align.runtime_must_not_create(id integer)'),
    (error) => error.code === '42501',
  );
});
