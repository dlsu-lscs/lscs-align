import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertCodeownerUsers,
  assertControlPlane,
  assertDeploymentPoliciesSafe,
  assertReviewerPermission,
  buildControlPlaneOperations,
  buildControlPlanePlan,
  buildRequiredBranchProtection,
  normalizeDeploymentBranchPolicies,
  normalizeEnvironment,
  REQUIRED_CHECKS,
} from '../scripts/policy/github-control-plane.mjs';

const reviewerId = 123456;

test('control-plane plan makes main the trust root and fully protects dev and main', () => {
  const plan = buildControlPlanePlan({
    owner: 'dlsu-lscs',
    repo: 'lscs-align',
    productionReviewerId: reviewerId,
  });

  assert.deepEqual(plan.repository, { default_branch: 'main' });
  assert.deepEqual(Object.keys(plan.branches), ['dev', 'main']);

  for (const protection of Object.values(plan.branches)) {
    assert.deepEqual(protection.required_status_checks, {
      strict: true,
      contexts: REQUIRED_CHECKS,
    });
    assert.equal(protection.enforce_admins, true);
    assert.deepEqual(protection.required_pull_request_reviews, {
      dismiss_stale_reviews: true,
      require_code_owner_reviews: true,
      required_approving_review_count: 1,
      require_last_push_approval: true,
    });
    assert.equal(protection.required_conversation_resolution, true);
    assert.equal(protection.allow_force_pushes, false);
    assert.equal(protection.allow_deletions, false);
    assert.equal(protection.required_linear_history, false);
    assert.equal(protection.restrictions, null);
  }
});

test('control-plane plan restricts both environments to main and protects production approval', () => {
  const plan = buildControlPlanePlan({
    owner: 'dlsu-lscs',
    repo: 'lscs-align',
    productionReviewerId: reviewerId,
  });

  assert.deepEqual(plan.environments.staging, {
    prevent_self_review: false,
    reviewers: [],
    deployment_branch_policy: {
      protected_branches: false,
      custom_branch_policies: true,
    },
  });
  assert.deepEqual(plan.environments.production, {
    prevent_self_review: true,
    reviewers: [{ type: 'User', id: reviewerId }],
    deployment_branch_policy: {
      protected_branches: false,
      custom_branch_policies: true,
    },
  });
  assert.deepEqual(plan.deploymentBranchPolicies, {
    staging: [{ name: 'main', type: 'branch' }],
    production: [{ name: 'main', type: 'branch' }],
  });
});

test('control-plane verification rejects unsafe or incomplete live state', () => {
  const expected = buildControlPlanePlan({
    owner: 'dlsu-lscs',
    repo: 'lscs-align',
    productionReviewerId: reviewerId,
  });

  assert.throws(
    () =>
      assertControlPlane(expected, {
        repository: { default_branch: 'dev' },
        branches: {},
        environments: {},
        deploymentBranchPolicies: {},
      }),
    /default branch must be main/i,
  );
});

test('control-plane verification accepts the exact configured state', () => {
  const expected = buildControlPlanePlan({
    owner: 'dlsu-lscs',
    repo: 'lscs-align',
    productionReviewerId: reviewerId,
  });

  assert.doesNotThrow(() => assertControlPlane(expected, structuredClone(expected)));
});

test('control-plane preflight requires accessible individual CODEOWNERS and reviewer access', () => {
  assert.doesNotThrow(() =>
    assertCodeownerUsers([
      { login: 'Leznerr', permission: 'admin' },
      { login: 'Ejaayy', permission: 'admin' },
      { login: 'RissyBen', permission: 'write' },
    ]),
  );
  assert.throws(
    () =>
      assertCodeownerUsers([
        { login: 'Leznerr', permission: 'admin' },
        { login: 'Ejaayy', permission: 'admin' },
      ]),
    /RissyBen/i,
  );
  assert.throws(
    () =>
      assertCodeownerUsers([
        { login: 'Leznerr', permission: 'admin' },
        { login: 'Ejaayy', permission: 'none' },
        { login: 'RissyBen', permission: 'write' },
      ]),
    /Ejaayy.*read access/i,
  );

  for (const permission of ['read', 'write', 'admin']) {
    assert.doesNotThrow(() => assertReviewerPermission(permission));
  }
  assert.throws(() => assertReviewerPermission('none'), /read access/i);
});

test('branch protection preserves stronger compatible controls', () => {
  const protection = buildRequiredBranchProtection('dev', {
    required_pull_request_reviews: { required_approving_review_count: 2 },
    required_linear_history: true,
    restrictions: {
      users: ['release-manager'],
      teams: ['senior-devsecops'],
      apps: [],
    },
  });

  assert.equal(protection.required_pull_request_reviews.required_approving_review_count, 2);
  assert.equal(protection.required_linear_history, true);
  assert.deepEqual(protection.restrictions, {
    users: ['release-manager'],
    teams: ['senior-devsecops'],
    apps: [],
  });
  assert.equal(buildRequiredBranchProtection('main', {}).required_linear_history, false);
});

test('apply operations validate existing policies and switch the default branch last', () => {
  assert.doesNotThrow(() => assertDeploymentPoliciesSafe('staging', []));
  assert.doesNotThrow(() =>
    assertDeploymentPoliciesSafe('production', [{ name: 'main', type: 'branch' }]),
  );
  assert.throws(
    () => assertDeploymentPoliciesSafe('production', [{ name: 'dev', type: 'branch' }]),
    /unexpected deployment branch policies/i,
  );

  const plan = buildControlPlanePlan({
    owner: 'dlsu-lscs',
    repo: 'lscs-align',
    productionReviewerId: reviewerId,
  });
  const operations = buildControlPlaneOperations(plan);
  assert.deepEqual(
    operations.slice(0, 2).map(({ kind, target }) => ({ kind, target })),
    [
      { kind: 'branch-protection', target: 'dev' },
      { kind: 'branch-protection', target: 'main' },
    ],
  );
  assert.deepEqual(operations.at(-1), {
    kind: 'repository',
    target: 'default-branch',
    body: { default_branch: 'main' },
  });
});

test('environment API responses retain prevent-self-review and normalize branch policies', () => {
  assert.deepEqual(
    normalizeEnvironment({
      protection_rules: [
        {
          type: 'required_reviewers',
          prevent_self_review: true,
          reviewers: [{ type: 'User', reviewer: { id: reviewerId } }],
        },
      ],
      deployment_branch_policy: {
        protected_branches: false,
        custom_branch_policies: true,
      },
    }),
    {
      prevent_self_review: true,
      reviewers: [{ type: 'User', id: reviewerId }],
      deployment_branch_policy: {
        protected_branches: false,
        custom_branch_policies: true,
      },
    },
  );

  assert.deepEqual(normalizeDeploymentBranchPolicies([{ name: 'main' }]), [
    { name: 'main', type: 'branch' },
  ]);
});

test('production approval probe is manual, permissionless, and targets the selected environment', async () => {
  const source = await readFile(
    new URL('../.github/workflows/environment-policy-probe.yml', import.meta.url),
    'utf8',
  );

  assert.match(source, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.match(source, /permissions:\s*\{\}/);
  assert.match(source, /environment:\s*\n\s+name:\s*\$\{\{\s*inputs\.environment\s*\}\}/);
  assert.doesNotMatch(source, /secrets\./);
  assert.doesNotMatch(source, /actions\/checkout/);
});

test('package exposes the authenticated control-plane command', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  );

  assert.equal(
    packageJson.scripts['policy:github-control-plane'],
    'node scripts/policy/github-control-plane.mjs',
  );
});
