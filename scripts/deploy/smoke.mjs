import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createReleaseManifest, readReleaseManifest } from '../release/manifest.mjs';

const origins = {
  staging: 'https://staging-align.dlsu-lscs.org',
  production: 'https://align.dlsu-lscs.org',
};

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} verification failed`);
  }
}

function verifyHeaders(response) {
  assertEqual(response.headers.get('cache-control'), 'no-store', 'cache-control');
  assertEqual(response.headers.get('x-content-type-options'), 'nosniff', 'x-content-type-options');
  assertEqual(response.headers.get('x-frame-options'), 'DENY', 'x-frame-options');
  if (!response.headers.get('content-security-policy')?.includes('frame-ancestors')) {
    throw new Error('content-security-policy verification failed');
  }
  if (!response.headers.get('referrer-policy')) {
    throw new Error('referrer-policy verification failed');
  }
  if (response.headers.get('access-control-allow-origin') === '*') {
    throw new Error('wildcard CORS is forbidden');
  }
}

async function getJson(fetchImpl, origin, path, headers) {
  const response = await fetchImpl(`${origin}${path}`, {
    headers,
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status !== 200 || response.redirected) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }
  verifyHeaders(response);
  if (!response.headers.get('content-type')?.startsWith('application/json')) {
    throw new Error(`${path} did not return JSON`);
  }
  return response.json();
}

function approvedRequestOptions(options) {
  const approvedOrigin = origins[options.environment];
  if (!approvedOrigin || options.baseUrl !== approvedOrigin) {
    throw new TypeError('deployment origin is not approved for the selected environment');
  }
  const headers = { accept: 'application/json' };
  const accessValues = [options.accessClientId, options.accessClientSecret];
  if (accessValues.some(Boolean) && !accessValues.every(Boolean)) {
    throw new TypeError('both Cloudflare Access service-token values are required');
  }
  if (options.accessClientId) {
    headers['CF-Access-Client-Id'] = options.accessClientId;
    headers['CF-Access-Client-Secret'] = options.accessClientSecret;
  }
  return { approvedOrigin, headers, fetchImpl: options.fetchImpl ?? fetch };
}

export async function verifyDeployment(options) {
  const manifest = createReleaseManifest(options.manifest);
  const { approvedOrigin, headers, fetchImpl } = approvedRequestOptions(options);

  const webHealth = await getJson(fetchImpl, approvedOrigin, '/healthz', headers);
  assertEqual(webHealth.status, 'ok', 'web liveness');
  assertEqual(webHealth.service, 'web', 'web routing');

  const revision = await getJson(fetchImpl, approvedOrigin, '/revision.json', headers);
  assertEqual(revision.service, 'web', 'revision routing');
  assertEqual(revision.environment, options.environment, 'environment');
  assertEqual(revision.sourceCommit, manifest.sourceCommit, 'web revision');

  const apiHealth = await getJson(fetchImpl, approvedOrigin, '/api/healthz', headers);
  assertEqual(apiHealth.status, 'ok', 'API liveness');
  assertEqual(apiHealth.service, 'api', 'API routing');
  assertEqual(apiHealth.sourceCommit, manifest.sourceCommit, 'API revision');

  const readiness = await getJson(fetchImpl, approvedOrigin, '/api/readyz', headers);
  assertEqual(readiness.status, 'ready', 'API readiness');
  assertEqual(readiness.service, 'api', 'API readiness routing');
  assertEqual(readiness.sourceCommit, manifest.sourceCommit, 'ready API revision');
  assertEqual(readiness.schemaVersion, manifest.schemaVersion, 'schema version');

  return { sourceCommit: manifest.sourceCommit, schemaVersion: manifest.schemaVersion };
}

export async function verifySchemaCompatibility(options) {
  const manifest = createReleaseManifest(options.manifest);
  const { approvedOrigin, headers, fetchImpl } = approvedRequestOptions(options);
  const readiness = await getJson(fetchImpl, approvedOrigin, '/api/readyz', headers);
  assertEqual(readiness.status, 'ready', 'API readiness');
  assertEqual(readiness.service, 'api', 'API readiness routing');
  assertEqual(readiness.schemaVersion, manifest.schemaVersion, 'schema version');
  return { schemaVersion: readiness.schemaVersion };
}

function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

export async function waitForDeployment(options) {
  const timeoutMs = options.timeoutMs ?? 600_000;
  const intervalMs = options.intervalMs ?? 10_000;
  const deadline = Date.now() + timeoutMs;
  do {
    try {
      return await verifyDeployment(options);
    } catch {
      if (Date.now() >= deadline) break;
      await wait(intervalMs);
    }
  } while (Date.now() < deadline);
  throw new Error('deployment did not become externally verifiable before timeout');
}

function argumentsByName(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 2) {
    const flag = values[index];
    const value = values[index + 1];
    if (!flag?.startsWith('--') || value === undefined) {
      throw new TypeError('arguments must be --name value pairs');
    }
    result[flag.slice(2)] = value;
  }
  return result;
}

async function main() {
  const values = argumentsByName(process.argv.slice(2));
  const manifest = await readReleaseManifest(values.manifest);
  await waitForDeployment({
    baseUrl: values.origin,
    environment: values.environment,
    manifest,
    accessClientId: process.env.CLOUDFLARE_ACCESS_CLIENT_ID,
    accessClientSecret: process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET,
  });
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (entrypoint === import.meta.url) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
