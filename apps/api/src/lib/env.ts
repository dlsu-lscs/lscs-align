import { config } from 'dotenv';
import { z } from 'zod';

config({ path: '../../.env', quiet: true });

const envSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
});

export const env = envSchema.parse(process.env);
