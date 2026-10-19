import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import test from 'node:test';

import { deployCompose } from '../scripts/deploy/dokploy.mjs';
import { renderReleaseCompose } from '../scripts/deploy/render-compose.mjs';

const manifest = {
  sourceCommit: 'a'.repeat(40),
  webImage: `ghcr.io/dlsu-lscs/lscs-align-web@sha256:${'b'.repeat(64)}`,
  apiImage: `ghcr.io/dlsu-lscs/lscs-align-api@sha256:${'c'.repeat(64)}`,
  schemaVersion: '0001',
  ciRunUrl: 'https://github.com/dlsu-lscs/lscs-align/actions/runs/1',
  builtAt: '2026-10-09T00:00:00.000Z',
};

const template = `
name: \${COMPOSE_PROJECT_NAME:?required}
services:
  web:
    image: \${WEB_IMAGE:?required}
    environment:
      APP_ENV: \${APP_ENV:?required}
      SOURCE_COMMIT: \${SOURCE_COMMIT:?required}
  api:
    image: \${API_IMAGE:?required}
    environment:
      APP_ENV: \${APP_ENV:?required}
      SOURCE_COMMIT: \${SOURCE_COMMIT:?required}
      EXPECTED_DATABASE_NAME: \${DATABASE_NAME:?required}
      DATABASE_NAME: \${DATABASE_NAME:?required}
  migrate:
    image: \${API_IMAGE:?required}
    environment:
      APP_ENV: \${APP_ENV:?required}
      EXPECTED_DATABASE_NAME: \${DATABASE_NAME:?required}
      DATABASE_NAME: \${DATABASE_NAME:?required}
  db:
    image: postgres:16
    environment:
      APP_ENV: \${APP_ENV:?required}
      DATABASE_NAME: \${DATABASE_NAME:?required}
`;

test('release Compose pins trusted staging identity and exact immutable artifacts', () => {
  const rendered = renderReleaseCompose(template, manifest, 'staging');

  assert.equal(rendered.services.web.image, manifest.webImage);
  assert.equal(rendered.services.api.image, manifest.apiImage);
  assert.equal(rendered.services.migrate.image, manifest.apiImage);
  assert.equal(rendered.services.web.environment.APP_ENV, 'staging');
  assert.equal(rendered.services.api.environment.SOURCE_COMMIT, manifest.sourceCommit);
  assert.equal(rendered.services.api.environment.EXPECTED_DATABASE_NAME, 'align_staging');
  assert.equal(rendered.services.api.environment.OTEL_SERVICE_NAME, 'align-api-staging');
  assert.equal(rendered.services.migrate.environment.EXPECTED_DATABASE_NAME, 'align_staging');
  assert.equal(rendered.services.db.environment.APP_ENV, 'staging');
  assert.equal(rendered.services.api.environment.DATABASE_NAME, '${DATABASE_NAME:?required}');
});

test('release Compose pins production identity independently of Dokploy variables', () => {
  const rendered = renderReleaseCompose(template, manifest, 'production');

  assert.equal(rendered.services.api.environment.APP_ENV, 'production');
  assert.equal(rendered.services.api.environment.EXPECTED_DATABASE_NAME, 'align_production');
  assert.equal(rendered.services.api.environment.OTEL_SERVICE_NAME, 'align-api-production');
  assert.equal(rendered.services.migrate.environment.EXPECTED_DATABASE_NAME, 'align_production');
});

test('release Compose rejects unknown targets and mutable image references', () => {
  assert.throws(() => renderReleaseCompose(template, manifest, 'development'), /target/);
  assert.throws(
    () => renderReleaseCompose(template, { ...manifest, webImage: 'web:latest' }, 'staging'),
    /webImage/,
  );
});

test('hosted release embeds the database bootstrap instead of relying on a host bind mount', async () => {
  const [source, bootstrap] = await Promise.all([
    readFile(new URL('../compose.yaml', import.meta.url), 'utf8'),
    readFile(new URL('../docker/postgres/001-bootstrap.sh', import.meta.url), 'utf8'),
  ]);
  const rendered = renderReleaseCompose(source, manifest, 'staging', bootstrap);

  assert.equal(rendered.configs['postgres-bootstrap'].file, undefined);
  assert.match(rendered.configs['postgres-bootstrap'].content, /\$\$\{APP_ENV/);
  assert.deepEqual(rendered.services.db.configs, [
    {
      source: 'postgres-bootstrap',
      target: '/docker-entrypoint-initdb.d/001-bootstrap.sh',
      mode: 365,
    },
  ]);
  assert.equal(JSON.stringify(rendered.services.db.volumes).includes('001-bootstrap'), false);
});

test('Dokploy client updates Compose before deploying and never sends runtime secrets', async (t) => {
  const requests = [];
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    requests.push({
      path: request.url,
      apiKey: request.headers['x-api-key'],
      body: JSON.parse(body),
    });
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  assert(address && typeof address === 'object');

  await deployCompose({
    baseUrl: `http://127.0.0.1:${address.port}`,
    apiKey: 'test-api-key',
    composeId: 'compose-123',
    composeFile: 'services: {}',
    title: 'Align staging aaaaaaa',
    description: 'source aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  });

  assert.deepEqual(
    requests.map((request) => request.path),
    ['/api/compose.update', '/api/compose.deploy'],
  );
  assert.equal(requests[0].apiKey, 'test-api-key');
  assert.deepEqual(requests[0].body, {
    composeId: 'compose-123',
    composeFile: 'services: {}',
  });
  assert.deepEqual(requests[1].body, {
    composeId: 'compose-123',
    title: 'Align staging aaaaaaa',
    description: 'source aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  });
  assert.equal(JSON.stringify(requests).includes('DATABASE_RUNTIME_PASSWORD'), false);
});

test('Dokploy client fails closed on non-TLS remote endpoints and API failures', async () => {
  await assert.rejects(
    deployCompose({
      baseUrl: 'http://dokploy.example.com',
      apiKey: 'key',
      composeId: 'id',
      composeFile: 'services: {}',
      title: 'release',
      description: 'release',
    }),
    /HTTPS/,
  );
});
