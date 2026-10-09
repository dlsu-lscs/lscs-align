import assert from 'node:assert/strict';
import test from 'node:test';

const revision = '89abcdef0123456789abcdef0123456789abcdef';

async function loadServerModule() {
  try {
    return await import('../src/server.ts');
  } catch (error) {
    assert.fail(`api server module must exist: ${error.code ?? error.message}`);
  }
}

async function start(t, options = {}) {
  const { createApiServer } = await loadServerModule();
  const server = createApiServer({
    environment: 'staging',
    revision,
    readiness: async () => ({ schemaVersion: '001' }),
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

test('GET /healthz does not query readiness dependencies', async (t) => {
  let readinessCalls = 0;
  const origin = await start(t, {
    readiness: async () => {
      readinessCalls += 1;
      throw new Error('database unavailable');
    },
  });

  const response = await fetch(`${origin}/healthz`);

  assert.equal(response.status, 200);
  assert.equal(readinessCalls, 0);
  assert.deepEqual(await response.json(), { status: 'ok', service: 'api', sourceCommit: revision });
});

test('GET /readyz reports configuration, database, and migration readiness', async (t) => {
  const origin = await start(t);
  const response = await fetch(`${origin}/readyz`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), {
    status: 'ready',
    service: 'api',
    sourceCommit: revision,
    schemaVersion: '001',
  });
});

test('GET /readyz fails closed without exposing dependency errors', async (t) => {
  const origin = await start(t, {
    readiness: async () => {
      throw new Error('internal dependency diagnostic: do-not-leak');
    },
  });
  const response = await fetch(`${origin}/readyz`);
  const text = await response.text();

  assert.equal(response.status, 503);
  assert.equal(text.includes('do-not-leak'), false);
  assert.deepEqual(JSON.parse(text), {
    status: 'unavailable',
    service: 'api',
    error: 'dependency_unavailable',
  });
});

test('request logs exclude query strings and invalid incoming request IDs', async (t) => {
  const records = [];
  const origin = await start(t, { logger: (record) => records.push(record) });

  await fetch(`${origin}/healthz?session=must-not-appear`, {
    headers: { 'x-request-id': 'spaces are invalid' },
  });

  assert.equal(records.length, 1);
  assert.notEqual(records[0].requestId, 'spaces are invalid');
  assert.equal(records[0].route, '/healthz');
  assert.equal(JSON.stringify(records).includes('must-not-appear'), false);
  assert.equal(records[0].environment, 'staging');
  assert.equal(records[0].service, 'api');
});

test('loadApiConfig rejects out-of-range ports and invalid environments', async () => {
  const { loadApiConfig } = await loadServerModule();

  assert.throws(
    () =>
      loadApiConfig({
        APP_ENV: 'preview',
        SOURCE_COMMIT: revision,
        API_PORT: '70000',
      }),
    /APP_ENV/,
  );
});
