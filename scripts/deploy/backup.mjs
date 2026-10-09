import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function endpoint(baseUrl, path) {
  const url = new URL(baseUrl);
  const local = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new TypeError('Dokploy URL must use HTTPS');
  }
  const prefix = url.pathname.replace(/\/+$/, '');
  const [pathname, query = ''] = path.split('?');
  url.pathname = `${prefix}${pathname}`;
  url.search = query;
  return url;
}

async function apiRequest(options, method, path, body) {
  if (!options.apiKey?.trim()) throw new TypeError('Dokploy API key is required');
  const response = await (options.fetchImpl ?? fetch)(endpoint(options.baseUrl, path), {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      'x-api-key': options.apiKey,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Dokploy backup request failed with HTTP ${response.status}`);
  }
  return response.json();
}

function backupEntries(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ['files', 'data', 'backups']) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  throw new Error('Dokploy backup listing returned an unexpected shape');
}

function fingerprints(payload) {
  return new Set(
    backupEntries(payload).map((entry) => {
      if (!entry || typeof entry !== 'object') return JSON.stringify(entry);
      return JSON.stringify({
        key: entry.key ?? entry.path ?? entry.name ?? null,
        lastModified: entry.lastModified ?? entry.updatedAt ?? entry.createdAt ?? null,
        size: entry.size ?? null,
      });
    }),
  );
}

function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

export async function createVerifiedBackup(options) {
  for (const field of ['backupId', 'destinationId', 'search']) {
    if (!options[field]?.trim()) throw new TypeError(`${field} is required`);
  }
  const listPath = `/api/backup.listBackupFiles?destinationId=${encodeURIComponent(options.destinationId)}&search=${encodeURIComponent(options.search)}`;
  const before = fingerprints(await apiRequest(options, 'GET', listPath));
  await apiRequest(options, 'POST', '/api/backup.manualBackupPostgres', {
    backupId: options.backupId,
  });

  const timeoutMs = options.timeoutMs ?? 600_000;
  const intervalMs = options.intervalMs ?? 10_000;
  const deadline = Date.now() + timeoutMs;
  do {
    const after = fingerprints(await apiRequest(options, 'GET', listPath));
    const newObjects = [...after].filter((value) => !before.has(value)).length;
    if (newObjects > 0) return { newObjects };
    await wait(intervalMs);
  } while (Date.now() < deadline);

  throw new Error('The requested production backup was not observable before timeout');
}

async function main() {
  await createVerifiedBackup({
    baseUrl: process.env.DOKPLOY_URL,
    apiKey: process.env.DOKPLOY_API_KEY,
    backupId: process.env.DOKPLOY_BACKUP_ID,
    destinationId: process.env.DOKPLOY_BACKUP_DESTINATION_ID,
    search: process.env.DOKPLOY_BACKUP_SEARCH,
  });
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (entrypoint === import.meta.url) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
