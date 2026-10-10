import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function endpoint(baseUrl) {
  const parsed = new URL(baseUrl);
  const local = ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) {
    throw new TypeError('Dokploy URL must use HTTPS');
  }
  return parsed;
}

async function request(baseUrl, apiKey, path, body) {
  if (!apiKey?.trim()) throw new TypeError('Dokploy API key is required');
  const url = endpoint(baseUrl);
  const prefix = url.pathname.replace(/\/+$/, '');
  url.pathname = `${prefix}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Dokploy ${path} failed with HTTP ${response.status}`);
  }
}

export async function deployCompose(options) {
  if (!options.composeId?.trim()) throw new TypeError('Dokploy Compose ID is required');
  if (!options.composeFile?.trim()) throw new TypeError('rendered Compose file is required');
  await request(options.baseUrl, options.apiKey, '/api/compose.update', {
    composeId: options.composeId,
    composeFile: options.composeFile,
  });
  await request(options.baseUrl, options.apiKey, '/api/compose.deploy', {
    composeId: options.composeId,
    title: options.title,
    description: options.description,
  });
}

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
  const composeFile = await readFile(values.compose, 'utf8');
  await deployCompose({
    baseUrl: process.env.DOKPLOY_URL,
    apiKey: process.env.DOKPLOY_API_KEY,
    composeId: process.env.DOKPLOY_COMPOSE_ID,
    composeFile,
    title: values.title,
    description: values.description,
  });
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (entrypoint === import.meta.url) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
