import pg from 'pg';

import { assertDatabaseIdentity, type DatabaseIdentity } from './migrations.ts';

const environments = new Set(['development', 'staging', 'production', 'test']);

interface UrlDatabaseConfig {
  connectionString: string;
  expectedIdentity: DatabaseIdentity;
}

interface DiscreteDatabaseConfig {
  connection: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  expectedIdentity: DatabaseIdentity;
}

type DatabaseConfig = UrlDatabaseConfig | DiscreteDatabaseConfig;

interface Queryable {
  query<Row extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<pg.QueryResult<Row>>;
}

function required(environment: NodeJS.ProcessEnv, variable: string): string {
  const value = environment[variable]?.trim();
  if (!value) {
    throw new Error(`${variable} is required`);
  }
  return value;
}

function expectedIdentity(environment: NodeJS.ProcessEnv): DatabaseIdentity {
  const appEnvironment = required(environment, 'APP_ENV');
  if (!environments.has(appEnvironment)) {
    throw new Error('APP_ENV must be development, staging, production, or test');
  }
  const databaseName = required(environment, 'EXPECTED_DATABASE_NAME');
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(databaseName)) {
    throw new Error('EXPECTED_DATABASE_NAME must be a safe PostgreSQL identifier');
  }
  return { environment: appEnvironment, databaseName };
}

function postgresUrl(environment: NodeJS.ProcessEnv, variable: string): string {
  const raw = required(environment, variable);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${variable} must be a valid PostgreSQL URL`);
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error(`${variable} must use the postgres or postgresql protocol`);
  }
  if (!parsed.hostname || !parsed.username || !parsed.pathname.slice(1)) {
    throw new Error(`${variable} must include a host, username, and database`);
  }
  return raw;
}

function discreteConnection(
  environment: NodeJS.ProcessEnv,
  userVariable: string,
  passwordVariable: string,
): DiscreteDatabaseConfig['connection'] {
  const port = Number(required(environment, 'DATABASE_PORT'));
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('DATABASE_PORT must be an integer from 1 to 65535');
  }
  const database = required(environment, 'DATABASE_NAME');
  if (database !== required(environment, 'EXPECTED_DATABASE_NAME')) {
    throw new Error('DATABASE_NAME must match EXPECTED_DATABASE_NAME');
  }
  const user = required(environment, userVariable);
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(user)) {
    throw new Error(`${userVariable} must be a safe PostgreSQL identifier`);
  }
  return {
    host: required(environment, 'DATABASE_HOST'),
    port,
    database,
    user,
    password: required(environment, passwordVariable),
  };
}

function requireUrlOrDiscreteFields(environment: NodeJS.ProcessEnv, urlVariable: string): void {
  if (!environment.DATABASE_HOST?.trim()) {
    throw new Error(`${urlVariable} or discrete PostgreSQL connection fields are required`);
  }
}

export function loadRuntimeDatabaseConfig(environment: NodeJS.ProcessEnv): DatabaseConfig {
  const identity = expectedIdentity(environment);
  if (!environment.DATABASE_URL?.trim()) {
    requireUrlOrDiscreteFields(environment, 'DATABASE_URL');
    return {
      connection: discreteConnection(
        environment,
        'DATABASE_RUNTIME_USER',
        'DATABASE_RUNTIME_PASSWORD',
      ),
      expectedIdentity: identity,
    };
  }
  return {
    connectionString: postgresUrl(environment, 'DATABASE_URL'),
    expectedIdentity: identity,
  };
}

export function loadMigrationDatabaseConfig(environment: NodeJS.ProcessEnv): DatabaseConfig {
  const identity = expectedIdentity(environment);
  if (!environment.MIGRATION_DATABASE_URL?.trim()) {
    requireUrlOrDiscreteFields(environment, 'MIGRATION_DATABASE_URL');
    return {
      connection: discreteConnection(
        environment,
        'DATABASE_MIGRATION_USER',
        'DATABASE_MIGRATION_PASSWORD',
      ),
      expectedIdentity: identity,
    };
  }
  return {
    connectionString: postgresUrl(environment, 'MIGRATION_DATABASE_URL'),
    expectedIdentity: identity,
  };
}

export function createDatabasePool(config: DatabaseConfig, service: string): pg.Pool {
  return new pg.Pool({
    ...('connectionString' in config
      ? { connectionString: config.connectionString }
      : config.connection),
    application_name: service,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
}

export function createReadinessProbe(
  database: Queryable,
  expected: DatabaseIdentity,
): () => Promise<{ schemaVersion: string }> {
  return async () => {
    const identity = await database.query<{
      database_name: string;
      environment: string | null;
    }>(
      "SELECT current_database() AS database_name, current_setting('align.environment', true) AS environment",
    );
    const row = identity.rows[0];
    if (!row?.environment) {
      throw new Error('Database identity mismatch: align.environment is not configured');
    }
    assertDatabaseIdentity(
      { databaseName: row.database_name, environment: row.environment },
      expected,
    );

    const migration = await database.query<{ version: string }>(
      'SELECT version FROM align.schema_migrations ORDER BY version DESC LIMIT 1',
    );
    const schemaVersion = migration.rows[0]?.version;
    if (!schemaVersion) {
      throw new Error('Database migrations are not ready');
    }
    return { schemaVersion };
  };
}
