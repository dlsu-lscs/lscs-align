import { createApp } from './app.js';
import { env } from './lib/env.js';

const app = createApp();

try {
  await app.listen({ port: env.API_PORT, host: '127.0.0.1' });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
