import type { FastifyInstance } from 'fastify';
import type { JsonObject } from '@align/shared';

export async function registerHealthRoute(app: FastifyInstance): Promise<void> {
  app.get('/health', async (): Promise<JsonObject> => ({ status: 'ok' }));
}
