import pg from 'pg';

import { createApp } from './app.ts';
import { createDatabase } from './lib/database.ts';
import { env, resolveDevDatabaseConfig } from './lib/env.ts';

const poolConfig = resolveDevDatabaseConfig(process.env);
const pool = poolConfig ? new pg.Pool(poolConfig) : undefined;
const app = createApp(pool ? { database: createDatabase(pool) } : {});

let shuttingDown = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await app.close();
    await pool?.end();
    process.exitCode = 0;
  });
}

try {
  await app.listen({ port: env.API_PORT, host: '127.0.0.1' });
} catch (error) {
  app.log.error(error);
  await pool?.end();
  process.exitCode = 1;
}
