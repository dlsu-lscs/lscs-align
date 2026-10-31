import assert from 'node:assert/strict';
import test from 'node:test';

async function loadNextConfig() {
  const loaded = await import('../next.config.ts');
  return loaded.default;
}

async function withEnv(overrides, callback) {
  const previous = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    return await callback();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('next.config rewrites /api/:path* to local Fastify in development', async () => {
  const nextConfig = await loadNextConfig();
  assert.equal(typeof nextConfig.rewrites, 'function');

  const rewrites = await withEnv(
    { NODE_ENV: 'development', API_PORT: undefined, API_UPSTREAM_URL: undefined },
    () => nextConfig.rewrites(),
  );

  assert.deepEqual(rewrites, [
    {
      source: '/api/:path*',
      destination: 'http://127.0.0.1:4000/:path*',
    },
  ]);
});

test('next.config honors API_PORT and API_UPSTREAM_URL in development', async () => {
  const nextConfig = await loadNextConfig();

  const customPort = await withEnv(
    { NODE_ENV: 'development', API_PORT: '4100', API_UPSTREAM_URL: undefined },
    () => nextConfig.rewrites(),
  );
  assert.deepEqual(customPort, [
    {
      source: '/api/:path*',
      destination: 'http://127.0.0.1:4100/:path*',
    },
  ]);

  const customUpstream = await withEnv(
    { NODE_ENV: 'development', API_PORT: '4100', API_UPSTREAM_URL: 'http://127.0.0.1:4500/' },
    () => nextConfig.rewrites(),
  );
  assert.deepEqual(customUpstream, [
    {
      source: '/api/:path*',
      destination: 'http://127.0.0.1:4500/:path*',
    },
  ]);
});

test('next.config disables local /api rewrites outside development', async () => {
  const nextConfig = await loadNextConfig();

  const productionRewrites = await withEnv(
    { NODE_ENV: 'production', API_UPSTREAM_URL: undefined },
    () => nextConfig.rewrites(),
  );

  assert.deepEqual(productionRewrites, []);
});
