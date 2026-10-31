import assert from 'node:assert/strict';
import test from 'node:test';

async function loadEnvModule() {
  return import('../src/lib/env.ts');
}

test('resolveDevDatabaseConfig returns undefined when no database variables are configured', async () => {
  const { resolveDevDatabaseConfig } = await loadEnvModule();

  assert.equal(resolveDevDatabaseConfig({}), undefined);
});

test('resolveDevDatabaseConfig accepts DATABASE_URL including hosted pooler usernames', async () => {
  const { resolveDevDatabaseConfig } = await loadEnvModule();

  const config = resolveDevDatabaseConfig({
    DATABASE_URL:
      'postgresql://postgres.projectref:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
  });

  assert.equal(
    config?.connectionString,
    'postgresql://postgres.projectref:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
  );
  assert.equal(config?.application_name, 'align-api-dev');

  assert.throws(
    () => resolveDevDatabaseConfig({ DATABASE_URL: 'http://localhost:5432/align_local' }),
    /DATABASE_URL/,
  );
});

test('resolveDevDatabaseConfig builds discrete pool options when DATABASE_HOST is set', async () => {
  const { resolveDevDatabaseConfig } = await loadEnvModule();

  const config = resolveDevDatabaseConfig({
    DATABASE_HOST: '127.0.0.1',
    DATABASE_PORT: '5432',
    DATABASE_NAME: 'align_local',
    DATABASE_RUNTIME_USER: 'align_app',
    DATABASE_RUNTIME_PASSWORD: 'local-runtime-password',
  });

  assert.equal(config?.host, '127.0.0.1');
  assert.equal(config?.port, 5432);
  assert.equal(config?.database, 'align_local');
  assert.equal(config?.user, 'align_app');
  assert.equal(config?.password, 'local-runtime-password');

  assert.throws(
    () =>
      resolveDevDatabaseConfig({
        DATABASE_HOST: '127.0.0.1',
        DATABASE_NAME: 'align_local',
      }),
    /DATABASE_RUNTIME_USER/,
  );
});
