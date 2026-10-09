import { createWebServer, loadWebConfig } from './server.ts';

const config = loadWebConfig(process.env);
const server = createWebServer(config);

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
