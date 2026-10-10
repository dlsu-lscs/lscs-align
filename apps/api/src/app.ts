import cors from '@fastify/cors';
import Fastify from 'fastify';
import { registerHealthRoute } from './routes/health.ts';

export function createApp() {
  const app = Fastify({ logger: false });

  const origins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.register(cors, { origin: origins });
  app.register(registerHealthRoute);

  app.setErrorHandler((_error, _request, reply) => {
    reply.status(500).send({ error: 'Internal Server Error' });
  });

  return app;
}
