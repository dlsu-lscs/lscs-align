import { config } from 'dotenv';
import { z } from 'zod';

config({ path: '../../.env', quiet: true });

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().url().optional().or(z.literal('')),
});

export const env = envSchema.parse(process.env);
