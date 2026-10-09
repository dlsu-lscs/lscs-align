import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const requiredFiles = {
  'CONTRIBUTING.md': [
    'working branch',
    '`dev`',
    '`main`',
    'two long-lived branches',
    'staging environment',
    'production environment',
    'squash',
    'merge commit',
  ],
  'SECURITY.md': ['security vulnerability', 'Do not open a public issue', 'tech@dlsu-lscs.org'],
  '.github/CODEOWNERS': ['/.github/', '/compose.yaml', '/apps/api/migrations/', '/docs/runbooks/'],
  '.github/PULL_REQUEST_TEMPLATE.md': ['Risk tier', 'Test evidence', 'Security impact', 'Rollback'],
  '.github/ISSUE_TEMPLATE/config.yml': ['blank_issues_enabled: false'],
  '.github/ISSUE_TEMPLATE/bug.yml': ['name: Bug report', 'Security impact'],
  '.github/ISSUE_TEMPLATE/feature.yml': ['name: Feature request', 'Acceptance criteria'],
  'docs/environments.md': [
    'staging-align.dlsu-lscs.org',
    'align.dlsu-lscs.org',
    'align_staging',
    'align_production',
    'two hosted databases',
    'lscsdev1',
    'lscsprod1',
  ],
  'docs/release-evidence-template.md': [
    'Source commit',
    'Web image digest',
    'API image digest',
    'Schema version',
    'Rollback target',
  ],
  'docs/runbooks/deployment.md': ['build once', '`main`', 'staging', 'production', 'digest'],
  'docs/runbooks/rollback.md': ['schema compatibility', 'known-good', 'forward recovery'],
  'docs/runbooks/incident-response.md': ['severity', 'incident commander', 'timeline'],
  'docs/runbooks/credential-leak.md': ['revoke', 'rotate', 'Git history'],
  'docs/runbooks/failed-migration.md': ['advisory lock', 'forward recovery', 'backup'],
  'docs/runbooks/backup-restore.md': ['RPO', 'RTO', 'isolated'],
  'docs/runbooks/server-recovery.md': ['lscsdev1', 'lscsprod1', 'restore'],
  'docs/adr/0001-branch-and-promotion-model.md': [
    'working branch',
    'dev',
    'main',
    'two long-lived branches',
    'staging environment',
    'production environment',
  ],
  'docs/adr/0002-compose-and-environment-topology.md': [
    'web',
    'api',
    'migrate',
    'PostgreSQL 16',
    'two hosted databases',
    'align_staging',
    'align_production',
  ],
  'docs/adr/0003-build-once-artifact-promotion.md': [
    'trusted `main`',
    'immutable',
    'digest',
    'rebuild',
  ],
  'docs/adr/0004-tier-classification.md': ['Tier 2', 'Tier 3'],
  'docs/adr/0005-same-origin-routing.md': ['/api/', 'Traefik', 'Cloudflare'],
};

for (const [file, requiredPhrases] of Object.entries(requiredFiles)) {
  test(`${file} exists and declares its required controls`, async () => {
    const content = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');

    for (const phrase of requiredPhrases) {
      assert.match(
        content.toLowerCase(),
        new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').toLowerCase()),
        `${file} must contain ${phrase}`,
      );
    }
  });
}

test('delivery uses branch promotion followed by environment promotion', async () => {
  const contributing = await readFile(new URL('../CONTRIBUTING.md', import.meta.url), 'utf8');
  const environments = await readFile(new URL('../docs/environments.md', import.meta.url), 'utf8');

  assert.match(contributing, /working branch\s*->\s*dev\s*->\s*main/i);
  assert.match(environments, /main.*staging.*production/is);
  assert.match(environments, /same.*image digests/is);
  assert.doesNotMatch(environments, /\|\s*`staging`\s*\|/i, 'staging must not be a branch');
  assert.doesNotMatch(environments, /dev-align\.dlsu-lscs\.org/i);
});
