import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('.env.example uses one server-side session model and safe placeholders', async () => {
  const content = await readFile(new URL('../.env.example', import.meta.url), 'utf8');

  assert.match(content, /^APP_ENV=development$/m);
  assert.match(content, /^SOURCE_COMMIT=[0-9a-f]{40}$/m);
  assert.match(content, /^DATABASE_HOST=db$/m);
  assert.match(content, /^DATABASE_PORT=5432$/m);
  assert.match(content, /^DATABASE_NAME=align_local$/m);
  assert.match(content, /^DATABASE_RUNTIME_USER=align_app$/m);
  assert.match(content, /^DATABASE_RUNTIME_PASSWORD=/m);
  assert.match(content, /^DATABASE_MIGRATION_USER=align_migrator$/m);
  assert.match(content, /^DATABASE_MIGRATION_PASSWORD=/m);
  assert.match(content, /^EXPECTED_DATABASE_NAME=align_local$/m);
  assert.match(content, /^SESSION_SECRET=/m);
  assert.doesNotMatch(content, /^JWT_SECRET=/m);
  assert.doesNotMatch(content, /dev-align\.dlsu-lscs\.org/);
  assert.doesNotMatch(content, /align_development/);
});
