import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const REQUIRED_CHECKS = Object.freeze([
  'Repository & Workflow Policy',
  'Quality & Unit Tests',
  'PostgreSQL Integration',
  'Container Security',
]);

const REQUIRED_CODEOWNER_USERS = Object.freeze(['Leznerr', 'Ejaayy', 'RissyBen']);

export function assertCodeownerUsers(users) {
  for (const required of REQUIRED_CODEOWNER_USERS) {
    const user = users.find(({ login }) => login.toLowerCase() === required.toLowerCase());
    assert.ok(user, `Required CODEOWNER ${required} was not found`);
    assert.ok(
      ['read', 'write', 'admin'].includes(user.permission),
      `CODEOWNER ${required} must have at least read access`,
    );
  }
}

export function assertReviewerPermission(permission) {
  assert.ok(
    ['read', 'write', 'admin'].includes(permission),
    'Production reviewer must have at least read access to the repository',
  );
}

export function buildRequiredBranchProtection(branch, current = {}) {
  const currentReviews = current.required_pull_request_reviews ?? {};
  return {
    required_status_checks: {
      strict: true,
      contexts: REQUIRED_CHECKS,
    },
    enforce_admins: true,
    required_pull_request_reviews: {
      dismiss_stale_reviews: true,
      require_code_owner_reviews: true,
      required_approving_review_count: Math.max(
        1,
        currentReviews.required_approving_review_count ?? 0,
      ),
      require_last_push_approval: true,
    },
    restrictions: current.restrictions ?? null,
    required_linear_history: branch === 'main' ? false : (current.required_linear_history ?? false),
    allow_force_pushes: false,
    allow_deletions: false,
    required_conversation_resolution: true,
  };
}

function environmentProtection({ production, reviewerId }) {
  return {
    prevent_self_review: production,
    reviewers: production ? [{ type: 'User', id: reviewerId }] : [],
    deployment_branch_policy: {
      protected_branches: false,
      custom_branch_policies: true,
    },
  };
}

export function buildControlPlanePlan({ owner, repo, productionReviewerId, currentBranches = {} }) {
  assert.match(owner, /^[A-Za-z0-9_.-]+$/, 'owner must be a GitHub organization or user name');
  assert.match(repo, /^[A-Za-z0-9_.-]+$/, 'repo must be a GitHub repository name');
  assert.ok(
    Number.isSafeInteger(productionReviewerId) && productionReviewerId > 0,
    'production reviewer ID must be a positive integer',
  );

  return {
    repository: { default_branch: 'main' },
    branches: {
      dev: buildRequiredBranchProtection('dev', currentBranches.dev),
      main: buildRequiredBranchProtection('main', currentBranches.main),
    },
    environments: {
      staging: environmentProtection({ production: false, reviewerId: productionReviewerId }),
      production: environmentProtection({ production: true, reviewerId: productionReviewerId }),
    },
    deploymentBranchPolicies: {
      staging: [{ name: 'main', type: 'branch' }],
      production: [{ name: 'main', type: 'branch' }],
    },
  };
}

export function buildControlPlaneOperations(plan) {
  return [
    ...Object.entries(plan.branches).map(([target, body]) => ({
      kind: 'branch-protection',
      target,
      body,
    })),
    ...Object.entries(plan.environments).map(([target, body]) => ({
      kind: 'environment',
      target,
      body,
    })),
    { kind: 'repository', target: 'default-branch', body: plan.repository },
  ];
}

function assertSubset(expected, actual, path = 'control plane') {
  if (Array.isArray(expected)) {
    assert.deepEqual(actual, expected, `${path} does not match`);
    return;
  }

  if (expected !== null && typeof expected === 'object') {
    assert.ok(actual !== null && typeof actual === 'object', `${path} must be an object`);
    for (const [key, value] of Object.entries(expected)) {
      assertSubset(value, actual[key], `${path}.${key}`);
    }
    return;
  }

  assert.equal(actual, expected, `${path} does not match`);
}

export function assertControlPlane(expected, actual) {
  assert.equal(actual.repository?.default_branch, 'main', 'default branch must be main');
  assertSubset(expected, actual);
}

function ghApi(path, { method = 'GET', body } = {}) {
  const args = ['api', path, '--method', method];
  if (body !== undefined) args.push('--input', '-');

  const output = execFileSync('gh', args, {
    encoding: 'utf8',
    input: body === undefined ? undefined : JSON.stringify(body),
    stdio: ['pipe', 'pipe', 'inherit'],
  }).trim();

  return output ? JSON.parse(output) : null;
}

function reviewerId(login) {
  const response = ghApi(`users/${encodeURIComponent(login)}`);
  assert.ok(
    Number.isSafeInteger(response?.id) && response.id > 0,
    'reviewer account was not found',
  );
  return response.id;
}

function verifyPrerequisites(owner, repo, productionReviewer) {
  const users = REQUIRED_CODEOWNER_USERS.map((login) => {
    const access = ghApi(
      `repos/${owner}/${repo}/collaborators/${encodeURIComponent(login)}/permission`,
    );
    return { login: access.user?.login ?? login, permission: access.permission };
  });
  assertCodeownerUsers(users);

  const permission = ghApi(
    `repos/${owner}/${repo}/collaborators/${encodeURIComponent(productionReviewer)}/permission`,
  );
  assertReviewerPermission(permission?.permission);
}

function normalizeRestrictions(value) {
  if (!value) return null;
  return {
    users: (value.users ?? []).map((user) => user.login ?? user),
    teams: (value.teams ?? []).map((team) => team.slug ?? team),
    apps: (value.apps ?? []).map((app) => app.slug ?? app),
  };
}

function normalizeBranchProtection(value) {
  return {
    required_status_checks: {
      strict: value.required_status_checks?.strict,
      contexts: [...(value.required_status_checks?.contexts ?? [])].sort(),
    },
    enforce_admins: value.enforce_admins?.enabled,
    required_pull_request_reviews: {
      dismiss_stale_reviews: value.required_pull_request_reviews?.dismiss_stale_reviews,
      require_code_owner_reviews: value.required_pull_request_reviews?.require_code_owner_reviews,
      required_approving_review_count:
        value.required_pull_request_reviews?.required_approving_review_count,
      require_last_push_approval: value.required_pull_request_reviews?.require_last_push_approval,
    },
    restrictions: normalizeRestrictions(value.restrictions),
    required_linear_history: value.required_linear_history?.enabled,
    allow_force_pushes: value.allow_force_pushes?.enabled,
    allow_deletions: value.allow_deletions?.enabled,
    required_conversation_resolution: value.required_conversation_resolution?.enabled,
  };
}

export function normalizeEnvironment(value) {
  const reviewerRule = value.protection_rules?.find((rule) => rule.type === 'required_reviewers');
  return {
    prevent_self_review: reviewerRule?.prevent_self_review ?? false,
    reviewers: (reviewerRule?.reviewers ?? []).map(({ type, reviewer }) => ({
      type,
      id: reviewer.id,
    })),
    deployment_branch_policy: value.deployment_branch_policy,
  };
}

export function normalizeDeploymentBranchPolicies(policies) {
  return policies.map(({ name, type }) => ({ name, type: type ?? 'branch' }));
}

export function assertDeploymentPoliciesSafe(environment, policies) {
  const unexpected = policies.filter(({ name, type }) => name !== 'main' || type !== 'branch');
  assert.deepEqual(
    unexpected,
    [],
    `${environment} has unexpected deployment branch policies; review them before continuing`,
  );
}

function readBranchPolicies(owner, repo, environment) {
  const response = ghApi(
    `repos/${owner}/${repo}/environments/${environment}/deployment-branch-policies?per_page=100`,
  );
  return normalizeDeploymentBranchPolicies(response?.branch_policies ?? []);
}

function readControlPlane(owner, repo) {
  const repository = ghApi(`repos/${owner}/${repo}`);
  const branches = Object.fromEntries(
    ['dev', 'main'].map((branch) => [
      branch,
      normalizeBranchProtection(ghApi(`repos/${owner}/${repo}/branches/${branch}/protection`)),
    ]),
  );
  const environments = Object.fromEntries(
    ['staging', 'production'].map((environment) => [
      environment,
      normalizeEnvironment(ghApi(`repos/${owner}/${repo}/environments/${environment}`)),
    ]),
  );

  return {
    repository: { default_branch: repository.default_branch },
    branches,
    environments,
    deploymentBranchPolicies: Object.fromEntries(
      ['staging', 'production'].map((environment) => [
        environment,
        readBranchPolicies(owner, repo, environment),
      ]),
    ),
  };
}

function readCurrentBranches(owner, repo) {
  return Object.fromEntries(
    ['dev', 'main'].map((branch) => [
      branch,
      normalizeBranchProtection(ghApi(`repos/${owner}/${repo}/branches/${branch}/protection`)),
    ]),
  );
}

function verifyExistingEnvironmentPolicies(owner, repo) {
  const response = ghApi(`repos/${owner}/${repo}/environments?per_page=100`);
  const existing = new Set((response?.environments ?? []).map(({ name }) => name));
  for (const environment of ['staging', 'production']) {
    if (!existing.has(environment)) continue;
    assertDeploymentPoliciesSafe(environment, readBranchPolicies(owner, repo, environment));
  }
}

function ensureMainDeploymentPolicy(owner, repo, environment) {
  const policies = readBranchPolicies(owner, repo, environment);
  assertDeploymentPoliciesSafe(environment, policies);

  if (policies.some(({ name, type }) => name === 'main' && type === 'branch')) return;

  ghApi(`repos/${owner}/${repo}/environments/${environment}/deployment-branch-policies`, {
    method: 'POST',
    body: { name: 'main', type: 'branch' },
  });
}

function applyControlPlane(owner, repo, plan) {
  verifyExistingEnvironmentPolicies(owner, repo);

  for (const operation of buildControlPlaneOperations(plan)) {
    if (operation.kind === 'branch-protection') {
      ghApi(`repos/${owner}/${repo}/branches/${operation.target}/protection`, {
        method: 'PUT',
        body: operation.body,
      });
      const actual = normalizeBranchProtection(
        ghApi(`repos/${owner}/${repo}/branches/${operation.target}/protection`),
      );
      assertSubset(operation.body, actual, `${operation.target} branch protection`);
      continue;
    }

    if (operation.kind === 'environment') {
      ghApi(`repos/${owner}/${repo}/environments/${operation.target}`, {
        method: 'PUT',
        body: operation.body,
      });
      ensureMainDeploymentPolicy(owner, repo, operation.target);
      const actual = normalizeEnvironment(
        ghApi(`repos/${owner}/${repo}/environments/${operation.target}`),
      );
      assertSubset(operation.body, actual, `${operation.target} environment`);
      assertSubset(
        plan.deploymentBranchPolicies[operation.target],
        readBranchPolicies(owner, repo, operation.target),
        `${operation.target} deployment branch policies`,
      );
      continue;
    }

    ghApi(`repos/${owner}/${repo}`, { method: 'PATCH', body: operation.body });
  }
}

function parseArguments(argv) {
  const values = {
    repository: 'dlsu-lscs/lscs-align',
    mode: 'plan',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--repo') values.repository = argv[++index];
    else if (argument === '--production-reviewer') values.productionReviewer = argv[++index];
    else if (argument === '--apply') values.mode = 'apply';
    else if (argument === '--verify') values.mode = 'verify';
    else throw new Error(`Unknown argument: ${argument}`);
  }

  assert.match(values.repository ?? '', /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, '--repo is invalid');
  assert.match(
    values.productionReviewer ?? '',
    /^[A-Za-z0-9-]+$/,
    '--production-reviewer LOGIN is required',
  );
  return values;
}

function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  const [owner, repo] = arguments_.repository.split('/');
  verifyPrerequisites(owner, repo, arguments_.productionReviewer);
  const productionReviewerId = reviewerId(arguments_.productionReviewer);
  const currentBranches = readCurrentBranches(owner, repo);
  const plan = buildControlPlanePlan({ owner, repo, productionReviewerId, currentBranches });

  if (arguments_.mode === 'apply') applyControlPlane(owner, repo, plan);
  if (arguments_.mode === 'plan') {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }

  const actual = readControlPlane(owner, repo);
  actual.branches.dev.required_status_checks.contexts.sort();
  actual.branches.main.required_status_checks.contexts.sort();
  const expected = structuredClone(plan);
  expected.branches.dev.required_status_checks.contexts.sort();
  expected.branches.main.required_status_checks.contexts.sort();
  assertControlPlane(expected, actual);
  process.stdout.write(`${JSON.stringify(actual, null, 2)}\n`);
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (entrypoint === import.meta.url) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
