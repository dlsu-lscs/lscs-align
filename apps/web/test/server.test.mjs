import assert from 'node:assert/strict';
import test from 'node:test';

const revision = '0123456789abcdef0123456789abcdef01234567';

async function loadServerModule() {
  try {
    return await import('../src/server.ts');
  } catch (error) {
    assert.fail(`web server module must exist: ${error.code ?? error.message}`);
  }
}

async function start(t, options = {}) {
  const { createWebServer } = await loadServerModule();
  const server = createWebServer({
    environment: 'development',
    revision,
    logger: () => {},
    ...options,
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const address = server.address();
  assert(address && typeof address === 'object');
  return `http://127.0.0.1:${address.port}`;
}

test('GET /healthz is a non-cacheable process liveness response', async (t) => {
  const origin = await start(t);
  const response = await fetch(`${origin}/healthz`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(await response.json(), { status: 'ok', service: 'web' });
});

test('GET /revision.json returns the deployed source identity', async (t) => {
  const origin = await start(t);
  const response = await fetch(`${origin}/revision.json`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), {
    service: 'web',
    environment: 'development',
    sourceCommit: revision,
  });
});

test('request logs exclude query strings and preserve only safe request IDs', async (t) => {
  const records = [];
  const origin = await start(t, { logger: (record) => records.push(record) });

  await fetch(`${origin}/healthz?access_token=must-not-appear`, {
    headers: { 'x-request-id': 'request-123' },
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].requestId, 'request-123');
  assert.equal(records[0].route, '/healthz');
  assert.equal(JSON.stringify(records).includes('must-not-appear'), false);
  assert.equal(records[0].service, 'web');
  assert.equal(records[0].revision, revision);
  assert.equal(typeof records[0].durationMs, 'number');
});

test('loadWebConfig rejects invalid production identity', async () => {
  const { loadWebConfig } = await loadServerModule();

  assert.throws(
    () => loadWebConfig({ APP_ENV: 'production', SOURCE_COMMIT: 'unknown', WEB_PORT: '3000' }),
    /SOURCE_COMMIT/,
  );
});
