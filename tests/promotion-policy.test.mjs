import assert from 'node:assert/strict';
import test from 'node:test';

import { assertPromotionSource } from '../scripts/policy/promotion.mjs';

test('main promotion accepts only dev and reviewed hotfix branch shapes', () => {
  assert.doesNotThrow(() =>
    assertPromotionSource({ eventName: 'pull_request', baseRef: 'main', headRef: 'dev' }),
  );
  assert.doesNotThrow(() =>
    assertPromotionSource({
      eventName: 'pull_request',
      baseRef: 'main',
      headRef: 'hotfix/session-fix',
    }),
  );
  assert.throws(
    () =>
      assertPromotionSource({ eventName: 'pull_request', baseRef: 'main', headRef: 'feat/bypass' }),
    /dev or hotfix/i,
  );
  assert.throws(
    () => assertPromotionSource({ eventName: 'pull_request', baseRef: 'main', headRef: 'hotfix/' }),
    /dev or hotfix/i,
  );
});

test('policy does not reject normal working-branch PRs into dev or trusted push CI', () => {
  assert.doesNotThrow(() =>
    assertPromotionSource({ eventName: 'pull_request', baseRef: 'dev', headRef: 'feat/calendar' }),
  );
  assert.doesNotThrow(() =>
    assertPromotionSource({ eventName: 'push', baseRef: undefined, headRef: undefined }),
  );
});
