import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';

const checkoutSha = '11d5960a326750d5838078e36cf38b85af677262';
const setupNodeSha = '49933ea5288caeca8642d1e84afbd3f7d6820020';
const uploadArtifactSha = 'ea165f8d65b6e75b540449e92b4886f43607fa02';
const downloadArtifactSha = 'd3f86a106a0bac45b974a628896c90dbdf5c8093';
const actionlintImage =
  'rhysd/actionlint@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667';
const gitleaksImage =
  'ghcr.io/gitleaks/gitleaks@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
const trivyImage =
  'ghcr.io/aquasecurity/trivy@sha256:62b1e65e8869bc4b4c6aa4fa2b21595256c7c2f6018a9d9ad61caf87187c1969';

async function workflow(name) {
  const source = await readFile(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');
  return { source, value: parse(source) };
}

function steps(job) {
  return job.steps ?? [];
}

function commands(job) {
  return steps(job)
    .map((step) => step.run)
    .filter(Boolean)
    .join('\n');
}

function assertActionsArePinned(value) {
  for (const job of Object.values(value.jobs)) {
    for (const step of steps(job)) {
      if (!step.uses) continue;
      assert.match(step.uses, /@[0-9a-f]{40}$/, `${step.uses} must use an immutable commit SHA`);
    }
  }
}

test('pull-request CI fails closed with fixed checks and immutable tooling', async () => {
  const { source, value } = await workflow('ci.yml');

  assert.deepEqual(value.on.pull_request.branches, ['dev', 'main']);
  assert.deepEqual(value.on.push.branches, ['dev', 'main']);
  assert.deepEqual(Object.keys(value.jobs), ['policy', 'quality', 'integration', 'containers']);
  assert.deepEqual(
    Object.values(value.jobs).map((job) => job.name),
    [
      'Repository & Workflow Policy',
      'Quality & Unit Tests',
      'PostgreSQL Integration',
      'Container Security',
    ],
  );

  for (const job of Object.values(value.jobs)) {
    assert.deepEqual(job.permissions, { contents: 'read' });
  }
  assertActionsArePinned(value);
  assert.match(source, new RegExp(`actions/checkout@${checkoutSha}`));
  assert.match(source, new RegExp(`actions/setup-node@${setupNodeSha}`));
  assert.match(source, new RegExp(actionlintImage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(source, new RegExp(gitleaksImage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(source, new RegExp(trivyImage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(source, /\bsecrets\./);
  assert.doesNotMatch(source, /--if-present|npm install(?!\s+--)/);

  const quality = commands(value.jobs.quality);
  for (const command of [
    'npm ci',
    'npm run format:check',
    'npm run lint',
    'npm run typecheck',
    'npm test',
    'npm run build',
    'npm audit --audit-level=high',
  ]) {
    assert.match(quality, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.equal(
    steps(value.jobs.quality).find((step) => step.uses?.startsWith('actions/setup-node@'))?.with[
      'node-version'
    ],
    24,
  );
  assert.match(commands(value.jobs.integration), /npm run test:integration/);
  assert.match(commands(value.jobs.containers), /docker build/);
  assert.match(commands(value.jobs.containers), /\/healthz/);
  assert.match(commands(value.jobs.containers), /WEB_PORT=3000/);
  assert.match(commands(value.jobs.containers), /API_PORT=4000/);
});

test('trusted-main release builds immutable images only after successful push CI', async () => {
  let loaded;
  try {
    loaded = await workflow('release.yml');
  } catch (error) {
    assert.fail(`release workflow must exist: ${error.message}`);
  }
  const { source, value } = loaded;
  const release = value.jobs['build-release'];

  assert.deepEqual(value.on.workflow_run.workflows, ['Align CI & DevSecOps Gate']);
  assert.deepEqual(value.on.workflow_run.branches, ['main']);
  assert.deepEqual(value.on.workflow_run.types, ['completed']);
  assert.deepEqual(release.permissions, { contents: 'read', packages: 'write' });
  assert.match(release.if, /conclusion == 'success'/);
  assert.match(release.if, /event == 'push'/);
  assert.match(release.if, /head_branch == 'main'/);
  assert.match(release.if, /head_repository\.full_name == github\.repository/);
  assertActionsArePinned(value);
  assert.match(source, new RegExp(`actions/checkout@${checkoutSha}`));
  assert.match(source, new RegExp(`actions/upload-artifact@${uploadArtifactSha}`));
  assert.doesNotMatch(commands(release), /\bsecrets\./);
  assert.doesNotMatch(source, /pull_request_target/);

  const releaseCommands = commands(release);
  assert.equal((releaseCommands.match(/docker buildx build/g) ?? []).length, 2);
  assert.equal((releaseCommands.match(/--push/g) ?? []).length, 2);
  assert.match(releaseCommands, /sha-\$\{SOURCE_COMMIT\}/);
  assert.match(releaseCommands, /scripts\/release\/manifest\.mjs/);
});

test('trusted release deploys staging then promotes the same manifest to protected production', async () => {
  const { source, value } = await workflow('release.yml');
  const staging = value.jobs['deploy-staging'];
  const production = value.jobs['promote-production'];

  assert.equal(value.concurrency.group, 'align-deployment-pipeline');
  assert.equal(value.concurrency['cancel-in-progress'], false);

  assert.deepEqual(Object.keys(value.jobs), [
    'build-release',
    'deploy-staging',
    'promote-production',
  ]);
  assert.equal(staging.needs, 'build-release');
  assert.equal(staging.environment.name, 'staging');
  assert.equal(staging.environment.url, 'https://staging-align.dlsu-lscs.org');
  assert.deepEqual(production.needs, ['build-release', 'deploy-staging']);
  assert.equal(production.environment.name, 'production');
  assert.equal(production.environment.url, 'https://align.dlsu-lscs.org');
  assert.deepEqual(staging.permissions, {
    actions: 'read',
    contents: 'read',
    deployments: 'write',
  });
  assert.deepEqual(production.permissions, staging.permissions);
  assertActionsArePinned(value);
  assert.match(source, new RegExp(`actions/download-artifact@${downloadArtifactSha}`));

  const stagingCommands = commands(staging);
  const productionCommands = commands(production);
  for (const text of [stagingCommands, productionCommands]) {
    assert.doesNotMatch(text, /docker (?:build|buildx)/);
    assert.match(text, /render-compose\.mjs/);
    assert.match(text, /dokploy\.mjs/);
    assert.match(text, /smoke\.mjs/);
    assert.match(text, /notify\.mjs/);
  }
  assert.match(stagingCommands, /--target staging/);
  assert.match(productionCommands, /--target production/);
  assert.equal(
    productionCommands.indexOf('backup.mjs') < productionCommands.indexOf('dokploy.mjs'),
    true,
  );
  assert.match(source, /CLOUDFLARE_ACCESS_CLIENT_ID/);
  assert.match(source, /DOKPLOY_API_KEY/);
  assert.match(source, /DISCORD_WEBHOOK_URL/);
});

test('manual rollback is protected, manifest-driven, and schema-compatible', async () => {
  let loaded;
  try {
    loaded = await workflow('rollback.yml');
  } catch (error) {
    assert.fail(`rollback workflow must exist: ${error.message}`);
  }
  const { source, value } = loaded;
  const rollback = value.jobs.rollback;

  assert(value.on.workflow_dispatch);
  assert.equal(value.concurrency.group, 'align-deployment-pipeline');
  assert.equal(rollback.environment.name, '${{ inputs.environment }}');
  assert.deepEqual(rollback.permissions, {
    actions: 'read',
    contents: 'read',
    deployments: 'write',
  });
  assertActionsArePinned(value);
  const rollbackCommands = commands(rollback);
  assert.doesNotMatch(rollbackCommands, /docker (?:build|buildx)/);
  assert.match(rollbackCommands, /git merge-base --is-ancestor/);
  assert.match(rollbackCommands, /schema-compatibility\.mjs/);
  assert.equal(
    rollbackCommands.indexOf('schema-compatibility.mjs') < rollbackCommands.indexOf('dokploy.mjs'),
    true,
  );
  assert.match(source, new RegExp(`actions/download-artifact@${downloadArtifactSha}`));
});
