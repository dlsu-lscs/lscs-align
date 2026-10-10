import { createDatabasePool, createReadinessProbe, loadRuntimeDatabaseConfig } from './database.ts';
import { createApiServer, loadApiConfig } from './server.ts';
import { createApp } from './app.js';

const config = loadApiConfig(process.env);
const databaseConfig = loadRuntimeDatabaseConfig(process.env);
const database = createDatabasePool(databaseConfig, 'align-api');
const app = createApp();
await app.ready();
const server = createApiServer({
  ...config,
  readiness: createReadinessProbe(database, databaseConfig.expectedIdentity),
  appHandler: app.routing.bind(app),
});

server.listen(config.port, config.host, () => {
  process.stdout.write(
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      environment: config.environment,
      service: 'api',
      revision: config.revision,
      event: 'listening',
      host: config.host,
      port: config.port,
    })}\n`,
  );
});

let shuttingDown = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(async (error) => {
      if (error) {
        process.stderr.write(
          `${JSON.stringify({ service: 'api', event: 'shutdown_failed', errorCode: 'server_close_failed' })}\n`,
        );
        process.exitCode = 1;
        return;
      }
      await database.end();
      await app.close();
      process.exitCode = 0;
    });
  });
}
