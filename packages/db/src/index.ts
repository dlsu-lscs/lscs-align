import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';

export function createDatabase(pool: Pool) {
  return drizzle(pool);
}
