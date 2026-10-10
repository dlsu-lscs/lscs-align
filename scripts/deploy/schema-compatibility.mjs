import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { readReleaseManifest } from '../release/manifest.mjs';
import { verifySchemaCompatibility } from './smoke.mjs';

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
  await verifySchemaCompatibility({
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
