import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const hotfixPattern = /^hotfix\/[a-z0-9][a-z0-9._/-]*$/;

export function assertPromotionSource({ eventName, baseRef, headRef }) {
  if (eventName !== 'pull_request' || baseRef !== 'main') return;
  if (headRef === 'dev' || hotfixPattern.test(headRef ?? '')) return;
  throw new Error('Pull requests into main must come from dev or hotfix/*');
}

function main() {
  assertPromotionSource({
    eventName: process.env.GITHUB_EVENT_NAME,
    baseRef: process.env.GITHUB_BASE_REF,
    headRef: process.env.GITHUB_HEAD_REF,
  });
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
