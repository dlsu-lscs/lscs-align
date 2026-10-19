import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const migrationFilename = /^(?<version>\d{4})_(?<name>[a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;
const advisoryLockKey = '4703561774247331661';

export interface DatabaseIdentity {
  environment: string;
  databaseName: string;
}

export interface Migration {
  version: string;
  name: string;
  checksum: string;
  sql: string;
}

interface QueryResult<Row extends Record<string, unknown> = Record<string, unknown>> {
  rows: Row[];
}

interface MigrationClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
  release(): void;
}

export interface MigrationPool {
  connect(): Promise<MigrationClient>;
}

interface RunMigrationsOptions {
  pool: MigrationPool;
  expectedIdentity: DatabaseIdentity;
  migrationsDirectory: string | URL;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

function migrationPath(directory: string | URL, filename: string): string | URL {
  if (directory instanceof URL) {
    return new URL(
      filename,
      directory.href.endsWith('/') ? directory : new URL(`${directory.href}/`),
    );
  }
  return join(directory, filename);
}

export function assertDatabaseIdentity(actual: DatabaseIdentity, expected: DatabaseIdentity): void {
  if (
    actual.environment !== expected.environment ||
    actual.databaseName !== expected.databaseName
  ) {
    throw new Error(
      `Database identity mismatch: expected ${expected.environment}/${expected.databaseName}`,
    );
  }
}

export async function discoverMigrations(directory: string | URL): Promise<Migration[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const migrations: Migration[] = [];
  const versions = new Set<string>();

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.sql')) continue;

    const match = migrationFilename.exec(entry.name);
    if (!match?.groups) {
      throw new Error(`Invalid migration filename: ${entry.name}`);
    }

    const { version, name } = match.groups;
    if (!version || !name) {
      throw new Error(`Invalid migration filename: ${entry.name}`);
    }
    if (versions.has(version)) {
      throw new Error(`Duplicate migration version ${version}`);
    }
    versions.add(version);

    const sql = await readFile(migrationPath(directory, entry.name), 'utf8');
    if (!sql.trim()) {
      throw new Error(`Migration ${entry.name} is empty`);
    }
    migrations.push({
      version,
      name,
      sql,
      checksum: createHash('sha256').update(sql).digest('hex'),
    });
  }

  if (migrations.length === 0) {
    throw new Error('No migrations found');
  }
  return migrations;
}

async function readDatabaseIdentity(client: MigrationClient): Promise<DatabaseIdentity> {
  const result = await client.query<{ database_name: string; environment: string | null }>(
    "SELECT current_database() AS database_name, current_setting('align.environment', true) AS environment",
  );
  const row = result.rows[0];
  if (!row?.environment) {
    throw new Error('Database identity mismatch: align.environment is not configured');
  }
  return { databaseName: row.database_name, environment: row.environment };
}

async function ensureMigrationHistory(client: MigrationClient): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS align');
    await client.query(`
      CREATE TABLE IF NOT EXISTS align.schema_migrations (
        version text PRIMARY KEY,
        name text NOT NULL,
        checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
        applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
      )
    `);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

export async function runMigrations(options: RunMigrationsOptions): Promise<MigrationResult> {
  const migrations = await discoverMigrations(options.migrationsDirectory);
  const client = await options.pool.connect();
  let lockHeld = false;
  const result: MigrationResult = { applied: [], skipped: [] };

  try {
    const actualIdentity = await readDatabaseIdentity(client);
    assertDatabaseIdentity(actualIdentity, options.expectedIdentity);

    await client.query('SELECT pg_advisory_lock($1::bigint)', [advisoryLockKey]);
    lockHeld = true;
    await ensureMigrationHistory(client);

    for (const migration of migrations) {
      const existing = await client.query<{ name: string; checksum: string }>(
        'SELECT name, checksum FROM align.schema_migrations WHERE version = $1',
        [migration.version],
      );
      const applied = existing.rows[0];
      if (applied) {
        if (applied.name !== migration.name || applied.checksum !== migration.checksum) {
          throw new Error(`Applied migration ${migration.version} does not match its source file`);
        }
        result.skipped.push(migration.version);
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO align.schema_migrations(version, name, checksum) VALUES ($1, $2, $3)',
          [migration.version, migration.name, migration.checksum],
        );
        await client.query('COMMIT');
        result.applied.push(migration.version);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    return result;
  } finally {
    if (lockHeld) {
      await client.query('SELECT pg_advisory_unlock($1::bigint)', [advisoryLockKey]);
    }
    client.release();
  }
}
