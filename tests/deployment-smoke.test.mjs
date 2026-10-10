import assert from 'node:assert/strict';
import test from 'node:test';

import {
  verifyDeployment,
  verifySchemaCompatibility,
  waitForDeployment,
} from '../scripts/deploy/smoke.mjs';

const manifest = {
  sourceCommit: 'a'.repeat(40),
  webImage: `ghcr.io/dlsu-lscs/lscs-align-web@sha256:${'b'.repeat(64)}`,
  apiImage: `ghcr.io/dlsu-lscs/lscs-align-api@sha256:${'c'.repeat(64)}`,
  schemaVersion: '0001',
  ciRunUrl: 'https://github.com/dlsu-lscs/lscs-align/actions/runs/1',
  builtAt: '2026-10-09T00:00:00.000Z',
};

const securityHeaders = {
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

function response(body, headers = securityHeaders) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

test('external smoke proves routing, security headers, revision, and migration readiness', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, headers: options.headers });
    const path = new URL(url).pathname;
    if (path === '/healthz') return response({ status: 'ok', service: 'web' });
    if (path === '/revision.json') {
      return response({
        service: 'web',
        environment: 'staging',
        sourceCommit: manifest.sourceCommit,
      });
    }
    if (path === '/api/healthz') {
      return response({ status: 'ok', service: 'api', sourceCommit: manifest.sourceCommit });
    }
    if (path === '/api/readyz') {
      return response({
        status: 'ready',
        service: 'api',
        sourceCommit: manifest.sourceCommit,
        schemaVersion: manifest.schemaVersion,
      });
    }
    throw new Error(`unexpected path ${path}`);
  };

  await verifyDeployment({
    baseUrl: 'https://staging-align.dlsu-lscs.org',
    environment: 'staging',
    manifest,
    accessClientId: 'id',
    accessClientSecret: 'secret',
    fetchImpl,
  });

  assert.deepEqual(
    calls.map((call) => new URL(call.url).pathname),
    ['/healthz', '/revision.json', '/api/healthz', '/api/readyz'],
  );
  for (const call of calls) {
    assert.equal(call.headers['CF-Access-Client-Id'], 'id');
    assert.equal(call.headers['CF-Access-Client-Secret'], 'secret');
  }
});

test('external smoke fails closed on a revision mismatch or an unapproved origin', async () => {
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname;
    if (path === '/healthz') return response({ status: 'ok', service: 'web' });
    if (path === '/revision.json') {
      return response({ service: 'web', environment: 'production', sourceCommit: 'f'.repeat(40) });
    }
    throw new Error('unexpected request');
  };

  await assert.rejects(
    verifyDeployment({
      baseUrl: 'https://align.dlsu-lscs.org',
      environment: 'production',
      manifest,
      fetchImpl,
    }),
    /revision/i,
  );
  await assert.rejects(
    verifyDeployment({
      baseUrl: 'https://attacker.example',
      environment: 'production',
      manifest,
      fetchImpl,
    }),
    /origin/i,
  );
});

test('rollback compatibility requires the currently deployed schema to match the target manifest', async () => {
  const compatibleFetch = async () =>
    response({
      status: 'ready',
      service: 'api',
      sourceCommit: 'f'.repeat(40),
      schemaVersion: manifest.schemaVersion,
    });
  await verifySchemaCompatibility({
    baseUrl: 'https://align.dlsu-lscs.org',
    environment: 'production',
    manifest,
    fetchImpl: compatibleFetch,
  });
  await assert.rejects(
    verifySchemaCompatibility({
      baseUrl: 'https://align.dlsu-lscs.org',
      environment: 'production',
      manifest: { ...manifest, schemaVersion: '0002' },
      fetchImpl: compatibleFetch,
    }),
    /schema version/i,
  );
});

test('deployment waiter tolerates rollout transitions but requires a fully verified release', async () => {
  let attempts = 0;
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname;
    if (path === '/healthz' && attempts++ < 2) {
      return new Response('{"status":"starting"}', {
        status: 503,
        headers: securityHeaders,
      });
    }
    if (path === '/healthz') return response({ status: 'ok', service: 'web' });
    if (path === '/revision.json') {
      return response({
        service: 'web',
        environment: 'production',
        sourceCommit: manifest.sourceCommit,
      });
    }
    if (path === '/api/healthz') {
      return response({ status: 'ok', service: 'api', sourceCommit: manifest.sourceCommit });
    }
    return response({
      status: 'ready',
      service: 'api',
      sourceCommit: manifest.sourceCommit,
      schemaVersion: manifest.schemaVersion,
    });
  };

  await waitForDeployment({
    baseUrl: 'https://align.dlsu-lscs.org',
    environment: 'production',
    manifest,
    fetchImpl,
    intervalMs: 1,
    timeoutMs: 100,
  });
  assert.equal(attempts, 3);
});
