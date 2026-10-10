import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse, stringify } from 'yaml';

import { createReleaseManifest, readReleaseManifest } from '../release/manifest.mjs';

const targets = {
  staging: { databaseName: 'align_staging', telemetryServiceName: 'align-api-staging' },
  production: { databaseName: 'align_production', telemetryServiceName: 'align-api-production' },
};

function requiredService(document, name) {
  const service = document?.services?.[name];
  if (!service || typeof service !== 'object') {
    throw new TypeError(`Compose service ${name} is required`);
  }
  if (!service.environment || typeof service.environment !== 'object') {
    throw new TypeError(`Compose service ${name} must declare environment values`);
  }
  return service;
}

export function renderReleaseCompose(source, inputManifest, targetName, bootstrapScript) {
  const target = targets[targetName];
  if (!target) {
    throw new TypeError('deployment target must be staging or production');
  }
  const manifest = createReleaseManifest(inputManifest);
  const document = parse(source);
  const web = requiredService(document, 'web');
  const api = requiredService(document, 'api');
  const migrate = requiredService(document, 'migrate');
  const database = requiredService(document, 'db');

  web.image = manifest.webImage;
  api.image = manifest.apiImage;
  migrate.image = manifest.apiImage;

  for (const service of [web, api, migrate, database]) {
    service.environment.APP_ENV = targetName;
  }
  web.environment.SOURCE_COMMIT = manifest.sourceCommit;
  api.environment.SOURCE_COMMIT = manifest.sourceCommit;
  api.environment.EXPECTED_DATABASE_NAME = target.databaseName;
  api.environment.OTEL_SERVICE_NAME = target.telemetryServiceName;
  migrate.environment.EXPECTED_DATABASE_NAME = target.databaseName;

  if (bootstrapScript !== undefined) {
    if (!bootstrapScript.trim()) throw new TypeError('database bootstrap script is empty');
    document.configs ??= {};
    document.configs['postgres-bootstrap'] = {
      content: bootstrapScript.replaceAll('$', () => '$$'),
    };
    database.configs = [
      {
        source: 'postgres-bootstrap',
        target: '/docker-entrypoint-initdb.d/001-bootstrap.sh',
        mode: 365,
      },
    ];
    database.volumes = (database.volumes ?? []).filter(
      (volume) => !String(volume).includes('001-bootstrap.sh'),
    );
  }

  return document;
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
  if (
    !values.template ||
    !values.manifest ||
    !values.bootstrap ||
    !values.target ||
    !values.output
  ) {
    throw new TypeError('--template, --manifest, --bootstrap, --target, and --output are required');
  }
  const [source, manifest, bootstrapScript] = await Promise.all([
    readFile(values.template, 'utf8'),
    readReleaseManifest(values.manifest),
    readFile(values.bootstrap, 'utf8'),
  ]);
  const rendered = renderReleaseCompose(source, manifest, values.target, bootstrapScript);
  await writeFile(values.output, stringify(rendered, { lineWidth: 0 }), 'utf8');
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (entrypoint === import.meta.url) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
