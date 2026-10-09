import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const fields = ['sourceCommit', 'webImage', 'apiImage', 'schemaVersion', 'ciRunUrl', 'builtAt'];
const imagePatterns = {
  webImage: /^ghcr\.io\/dlsu-lscs\/lscs-align-web@sha256:[0-9a-f]{64}$/,
  apiImage: /^ghcr\.io\/dlsu-lscs\/lscs-align-api@sha256:[0-9a-f]{64}$/,
};

function requireMatch(field, value, pattern) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new TypeError(`${field} is invalid`);
  }
}

export function createReleaseManifest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('release manifest must be an object');
  }

  const keys = Object.keys(input).sort();
  const expectedKeys = [...fields].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    throw new TypeError('release manifest fields are invalid');
  }

  requireMatch('sourceCommit', input.sourceCommit, /^[0-9a-f]{40}$/);
  requireMatch('webImage', input.webImage, imagePatterns.webImage);
  requireMatch('apiImage', input.apiImage, imagePatterns.apiImage);
  requireMatch('schemaVersion', input.schemaVersion, /^\d{4,}$/);
  requireMatch(
    'ciRunUrl',
    input.ciRunUrl,
    /^https:\/\/github\.com\/dlsu-lscs\/lscs-align\/actions\/runs\/\d+$/,
  );
  requireMatch('builtAt', input.builtAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  if (new Date(input.builtAt).toISOString() !== input.builtAt) {
    throw new TypeError('builtAt is invalid');
  }

  return Object.fromEntries(fields.map((field) => [field, input[field]]));
}

export async function writeReleaseManifest(path, input) {
  const manifest = createReleaseManifest(input);
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}

export async function readReleaseManifest(path) {
  const encoded = await readFile(path, 'utf8');
  return createReleaseManifest(JSON.parse(encoded));
}

function parseArguments(arguments_) {
  const values = {};
  for (let index = 0; index < arguments_.length; index += 2) {
    const flag = arguments_[index];
    const value = arguments_[index + 1];
    if (!flag?.startsWith('--') || value === undefined) {
      throw new TypeError('manifest arguments must be --name value pairs');
    }
    values[flag.slice(2)] = value;
  }
  return values;
}

async function main() {
  const values = parseArguments(process.argv.slice(2));
  await writeReleaseManifest(values.output, {
    sourceCommit: values['source-commit'],
    webImage: values['web-image'],
    apiImage: values['api-image'],
    schemaVersion: values['schema-version'],
    ciRunUrl: values['ci-run-url'],
    builtAt: values['built-at'],
  });
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (entrypoint === import.meta.url) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
