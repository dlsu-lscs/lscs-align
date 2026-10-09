import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function text(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

for (const [service, port] of [
  ['web', 3000],
  ['api', 4000],
]) {
  test(`${service} image is pinned, multi-stage, non-root, revisioned, and healthy`, async () => {
    const dockerfile = await text(`apps/${service}/Dockerfile`);

    assert.match(dockerfile, /^FROM node:24[^\s]*@sha256:[0-9a-f]{64} AS /m);
    assert.match(dockerfile, / AS build/m);
    assert.match(
      dockerfile,
      /^FROM gcr\.io\/distroless\/nodejs24-debian13:nonroot@sha256:[0-9a-f]{64} AS runtime$/m,
    );
    assert.match(dockerfile, /^USER nonroot$/m);
    assert.match(dockerfile, new RegExp(`^EXPOSE ${port}$`, 'm'));
    assert.match(dockerfile, /^HEALTHCHECK /m);
    assert.match(dockerfile, /\/nodejs\/bin\/node/);
    assert.match(dockerfile, new RegExp(`127\\.0\\.0\\.1:${port}/healthz`));
    assert.match(dockerfile, /org\.opencontainers\.image\.revision/);
    assert.doesNotMatch(dockerfile, /npm install(?!\s+--)/);
  });
}

test('Compose defines the four-service dependency chain and no database host port', async () => {
  const compose = await text('compose.yaml');

  for (const service of ['web:', 'api:', 'migrate:', 'db:']) {
    assert.match(compose, new RegExp(`^  ${service}$`, 'm'));
  }
  assert.match(compose, /condition: service_completed_successfully/);
  assert.match(compose, /condition: service_healthy/);
  assert.match(compose, /postgres:16[^\s]*@sha256:[0-9a-f]{64}/);
  assert.doesNotMatch(compose, /^\s+ports:/m);
  assert.match(compose, /internal: true/);
  assert.match(compose, /PathPrefix\(`\/api`\)/);
  assert.match(compose, /stripprefix\.prefixes=\/api/);
});

test('Compose isolates credentials and applies service hardening', async () => {
  const compose = await text('compose.yaml');
  const webBlock = compose.match(/^ {2}web:[\s\S]*?(?=^ {2}api:)/m)?.[0] ?? '';
  const apiBlock = compose.match(/^ {2}api:[\s\S]*?(?=^ {2}migrate:)/m)?.[0] ?? '';
  const migrateBlock = compose.match(/^ {2}migrate:[\s\S]*?(?=^ {2}db:)/m)?.[0] ?? '';

  assert.doesNotMatch(webBlock, /DATABASE|PASSWORD|SECRET/);
  assert.match(apiBlock, /DATABASE_RUNTIME_USER/);
  assert.match(apiBlock, /DATABASE_RUNTIME_PASSWORD/);
  assert.match(apiBlock, /SESSION_SECRET/);
  assert.doesNotMatch(apiBlock, /MIGRATION_DATABASE_URL|POSTGRES_ADMIN_PASSWORD/);
  assert.match(migrateBlock, /DATABASE_MIGRATION_USER/);
  assert.match(migrateBlock, /DATABASE_MIGRATION_PASSWORD/);
  assert.doesNotMatch(migrateBlock, /DATABASE_RUNTIME_(?:USER|PASSWORD)|POSTGRES_ADMIN_PASSWORD/);

  assert.equal((compose.match(/cap_drop:\s*\n\s*- ALL/g) ?? []).length, 3);
  assert.equal((compose.match(/read_only: true/g) ?? []).length, 3);
  assert.equal((compose.match(/no-new-privileges:true/g) ?? []).length, 3);
  assert.equal((compose.match(/user: ['"]65532:65532['"]/g) ?? []).length, 3);
  assert.equal((compose.match(/max-size: ['"]10m['"]/g) ?? []).length, 4);
  assert.equal((compose.match(/max-file: ['"]3['"]/g) ?? []).length, 4);
  assert.match(compose, /memory: 256M/);
  assert.match(compose, /memory: 512M/);
});

test('database bootstrap creates separate non-superuser roles safely', async () => {
  const bootstrap = await text('docker/postgres/001-bootstrap.sh');

  assert.match(bootstrap, /NOSUPERUSER/);
  assert.match(bootstrap, /NOCREATEDB/);
  assert.match(bootstrap, /NOCREATEROLE/);
  assert.match(bootstrap, /align\.environment/);
  assert.match(bootstrap, /REVOKE ALL ON DATABASE/);
  assert.match(bootstrap, /REVOKE CREATE ON SCHEMA public/);
  assert.match(bootstrap, /format\('CREATE ROLE %I LOGIN PASSWORD %L/);
  assert.doesNotMatch(bootstrap, /align_(?:runtime|migration)_password/);
});

test('.dockerignore excludes local secrets, dependencies, and build products', async () => {
  const dockerignore = await text('.dockerignore');

  for (const entry of ['.env', 'node_modules', 'dist', '.git', 'coverage']) {
    assert.match(dockerignore, new RegExp(`^${entry.replace('.', '\\.')}.*$`, 'm'));
  }
  assert.match(dockerignore, /^!\.env\.example$/m);
});
