import { createWebServer, loadWebConfig } from './server.ts';
import next from 'next';

const config = loadWebConfig(process.env);
const createNext = next as unknown as typeof import('next/dist/server/next.js').default;
const app = createNext({ dev: false, dir: process.cwd() });
await app.prepare();
const server = createWebServer({ ...config, appHandler: app.getRequestHandler() });

server.listen(config.port, config.host, () => {
  process.stdout.write(
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      environment: config.environment,
      service: 'web',
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
    server.close((error) => {
      if (error) {
        process.stderr.write(
          `${JSON.stringify({ service: 'web', event: 'shutdown_failed', errorCode: 'server_close_failed' })}\n`,
        );
        process.exitCode = 1;
        return;
      }
      process.exitCode = 0;
    });
  });
}
