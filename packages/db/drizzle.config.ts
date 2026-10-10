import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '../../.env', quiet: true });

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : undefined,
});
