import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import type pg from 'pg';
import { z } from 'zod';

config({ path: fileURLToPath(new URL('../../../../.env.local', import.meta.url)), quiet: true });
config({ path: fileURLToPath(new URL('../../../../.env', import.meta.url)), quiet: true });

const envSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
});

export function loadDevEnv(environment: NodeJS.ProcessEnv = process.env) {
  return envSchema.parse(environment);
}

export function resolveDevDatabaseConfig(
  environment: NodeJS.ProcessEnv = process.env,
): pg.PoolConfig | undefined {
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (databaseUrl) {
    let parsed: URL;
    try {
      parsed = new URL(databaseUrl);
    } catch {
      throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
    }
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
      throw new Error('DATABASE_URL must use the postgres or postgresql protocol');
    }
    if (!parsed.hostname || !parsed.username || !parsed.pathname.slice(1)) {
      throw new Error('DATABASE_URL must include a host, username, and database');
    }
    return {
      connectionString: databaseUrl,
      application_name: 'align-api-dev',
      max: 10,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
    };
  }

  const host = environment.DATABASE_HOST?.trim();
  if (!host) {
    return undefined;
  }

  const port = Number(environment.DATABASE_PORT?.trim() || '5432');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('DATABASE_PORT must be an integer from 1 to 65535');
  }

  const database = environment.DATABASE_NAME?.trim();
  const user = environment.DATABASE_RUNTIME_USER?.trim();
  const password = environment.DATABASE_RUNTIME_PASSWORD?.trim();
  if (!database || !user || !password) {
    throw new Error(
      'DATABASE_NAME, DATABASE_RUNTIME_USER, and DATABASE_RUNTIME_PASSWORD are required when DATABASE_HOST is set',
    );
  }

  return {
    host,
    port,
    database,
    user,
    password,
    application_name: 'align-api-dev',
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  };
}

export const env = loadDevEnv(process.env);
