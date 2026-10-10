import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

async function manifestModule() {
  try {
    return await import('../scripts/release/manifest.mjs');
  } catch (error) {
    assert.fail(`release manifest module must exist: ${error.message}`);
  }
}

const validInput = {
  sourceCommit: '0123456789abcdef0123456789abcdef01234567',
  webImage:
    'ghcr.io/dlsu-lscs/lscs-align-web@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  apiImage:
    'ghcr.io/dlsu-lscs/lscs-align-api@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  schemaVersion: '0001',
  ciRunUrl: 'https://github.com/dlsu-lscs/lscs-align/actions/runs/123',
  builtAt: '2026-10-09T12:34:56.000Z',
};

test('release manifest accepts only the exact immutable release schema', async () => {
  const { createReleaseManifest } = await manifestModule();

  assert.deepEqual(createReleaseManifest(validInput), validInput);
});

for (const [field, value] of [
  ['sourceCommit', 'main'],
  ['webImage', 'ghcr.io/dlsu-lscs/lscs-align-web:latest'],
  [
    'apiImage',
    'ghcr.io/example/api@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  ],
  ['schemaVersion', '../0001'],
  ['ciRunUrl', 'http://github.com/example/run'],
  ['builtAt', 'yesterday'],
]) {
  test(`release manifest rejects invalid ${field}`, async () => {
    const { createReleaseManifest } = await manifestModule();

    assert.throws(() => createReleaseManifest({ ...validInput, [field]: value }), field);
  });
}

test('release manifest writer creates stable JSON that validates on read', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'align-release-manifest-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = join(directory, 'release-manifest.json');
  const { readReleaseManifest, writeReleaseManifest } = await manifestModule();

  await writeReleaseManifest(output, validInput);

  const encoded = await readFile(output, 'utf8');
  assert.equal(encoded, `${JSON.stringify(validInput, null, 2)}\n`);
  assert.deepEqual(await readReleaseManifest(output), validInput);
});
