import cors from '@fastify/cors';
import Fastify from 'fastify';
import { registerHealthRoute } from './routes/health.js';

export function createApp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: 'http://localhost:3000' });
  app.register(registerHealthRoute);

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    reply.status(500).send({ error: 'Internal Server Error' });
  });

  return app;
}
