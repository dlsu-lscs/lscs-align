import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

async function loadMigrationModule() {
  try {
    return await import('../src/migrations.ts');
  } catch (error) {
    assert.fail(`migration module must exist: ${error.code ?? error.message}`);
  }
}

test('assertDatabaseIdentity accepts only the exact environment and database', async () => {
  const { assertDatabaseIdentity } = await loadMigrationModule();
  const expected = { environment: 'staging', databaseName: 'align_staging' };

  assert.doesNotThrow(() => assertDatabaseIdentity(expected, expected));
  assert.throws(
    () =>
      assertDatabaseIdentity(
        { environment: 'production', databaseName: 'align_production' },
        expected,
      ),
    /Database identity mismatch/,
  );
  assert.throws(
    () =>
      assertDatabaseIdentity(
        { environment: 'staging', databaseName: 'align_staging_shadow' },
        expected,
      ),
    /Database identity mismatch/,
  );
});

test('discoverMigrations returns ordered migrations with stable SHA-256 checksums', async () => {
  const { discoverMigrations } = await loadMigrationModule();
  const migrations = await discoverMigrations(new URL('../migrations/', import.meta.url));

  assert.deepEqual(
    migrations.map(({ version, name }) => ({ version, name })),
    [{ version: '0001', name: 'platform_baseline' }],
  );
  assert.match(migrations[0].checksum, /^[0-9a-f]{64}$/);
  assert.match(migrations[0].sql, /platform_metadata/);
});

test('discoverMigrations rejects duplicate versions before touching a database', async (t) => {
  const { discoverMigrations } = await loadMigrationModule();
  const directory = await mkdtemp(join(tmpdir(), 'align-migrations-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  await writeFile(join(directory, '0001_first.sql'), 'SELECT 1;\n');
  await writeFile(join(directory, '0001_second.sql'), 'SELECT 2;\n');

  await assert.rejects(discoverMigrations(directory), /Duplicate migration version 0001/);
});

test('discoverMigrations rejects malformed migration filenames', async (t) => {
  const { discoverMigrations } = await loadMigrationModule();
  const directory = await mkdtemp(join(tmpdir(), 'align-migrations-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  await writeFile(join(directory, 'latest.sql'), 'SELECT 1;\n');

  await assert.rejects(discoverMigrations(directory), /Invalid migration filename/);
});
