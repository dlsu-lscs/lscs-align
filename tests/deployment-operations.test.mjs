import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

import { createVerifiedBackup } from '../scripts/deploy/backup.mjs';
import { buildNotification, sendNotification } from '../scripts/deploy/notify.mjs';

async function listen(t, handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  assert(address && typeof address === 'object');
  return `http://127.0.0.1:${address.port}`;
}

test('production backup gate observes a new backup object after triggering it', async (t) => {
  let lists = 0;
  const calls = [];
  const baseUrl = await listen(t, async (request, response) => {
    calls.push({ path: request.url, apiKey: request.headers['x-api-key'] });
    response.setHeader('content-type', 'application/json');
    if (request.method === 'GET') {
      lists += 1;
      response.end(
        JSON.stringify(
          lists === 1
            ? [{ key: 'align/old.dump', lastModified: '2026-10-08T00:00:00Z' }]
            : [
                { key: 'align/old.dump', lastModified: '2026-10-08T00:00:00Z' },
                { key: 'align/new.dump', lastModified: '2026-10-09T00:00:00Z' },
              ],
        ),
      );
      return;
    }
    response.end(JSON.stringify({ ok: true }));
  });

  const result = await createVerifiedBackup({
    baseUrl,
    apiKey: 'backup-key',
    backupId: 'backup-1',
    destinationId: 'destination-1',
    search: 'align-production',
    intervalMs: 1,
    timeoutMs: 100,
  });

  assert.equal(result.newObjects, 1);
  assert.match(calls[0].path, /^\/api\/backup\.listBackupFiles\?/);
  assert.equal(calls[1].path, '/api/backup.manualBackupPostgres');
  assert.match(calls[2].path, /^\/api\/backup\.listBackupFiles\?/);
  assert(calls.every((call) => call.apiKey === 'backup-key'));
});

test('production backup gate times out when no new backup is observable', async (t) => {
  const baseUrl = await listen(t, async (request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(request.method === 'GET' ? '[]' : '{"ok":true}');
  });

  await assert.rejects(
    createVerifiedBackup({
      baseUrl,
      apiKey: 'backup-key',
      backupId: 'backup-1',
      destinationId: 'destination-1',
      search: 'align-production',
      intervalMs: 1,
      timeoutMs: 5,
    }),
    /not observable/i,
  );
});

test('Discord notification is allowlisted, traceable, and excludes credentials', async (t) => {
  let received;
  const webhookUrl = await listen(t, async (request, response) => {
    let encoded = '';
    for await (const chunk of request) encoded += chunk;
    received = JSON.parse(encoded);
    response.writeHead(204);
    response.end();
  });
  const input = {
    environment: 'staging',
    status: 'success',
    sourceCommit: 'a'.repeat(40),
    webImage: `ghcr.io/dlsu-lscs/lscs-align-web@sha256:${'b'.repeat(64)}`,
    apiImage: `ghcr.io/dlsu-lscs/lscs-align-api@sha256:${'c'.repeat(64)}`,
    migrationResult: 'verified',
    workflowUrl: 'https://github.com/dlsu-lscs/lscs-align/actions/runs/1',
    operator: 'octocat',
    timestamp: '2026-10-09T00:00:00.000Z',
  };

  assert.deepEqual(Object.keys(buildNotification(input)).sort(), ['allowed_mentions', 'content']);
  await sendNotification({ webhookUrl, input, allowLocalhost: true });
  assert.match(received.content, /staging/);
  assert.match(received.content, /verified/);
  assert.equal(received.content.includes('password'), false);
  assert.deepEqual(received.allowed_mentions, { parse: [] });
});
