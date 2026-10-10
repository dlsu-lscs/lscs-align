import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const environments = new Set(['staging', 'production']);
const statuses = new Set(['success', 'failure', 'cancelled']);
const imagePattern = /^ghcr\.io\/dlsu-lscs\/lscs-align-(?:web|api)@sha256:[0-9a-f]{64}$/;

function requiredString(input, field, pattern) {
  const value = input[field];
  if (typeof value !== 'string' || !value || (pattern && !pattern.test(value))) {
    throw new TypeError(`${field} is invalid`);
  }
  return value;
}

export function buildNotification(input) {
  const environment = requiredString(input, 'environment');
  const status = requiredString(input, 'status');
  if (!environments.has(environment)) throw new TypeError('environment is invalid');
  if (!statuses.has(status)) throw new TypeError('status is invalid');
  const sourceCommit = requiredString(input, 'sourceCommit', /^[0-9a-f]{40}$/);
  const webImage = requiredString(input, 'webImage', imagePattern);
  const apiImage = requiredString(input, 'apiImage', imagePattern);
  const migrationResult = requiredString(
    input,
    'migrationResult',
    /^(verified|failed_or_unverified)$/,
  );
  const workflowUrl = requiredString(
    input,
    'workflowUrl',
    /^https:\/\/github\.com\/dlsu-lscs\/lscs-align\/actions\/runs\/\d+$/,
  );
  const operator = requiredString(input, 'operator', /^[A-Za-z0-9-]{1,39}$/);
  const timestamp = requiredString(
    input,
    'timestamp',
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
  );

  return {
    content: [
      `Align ${environment} deployment: ${status}`,
      `Commit: ${sourceCommit}`,
      `Web: ${webImage}`,
      `API: ${apiImage}`,
      `Migration/readiness: ${migrationResult}`,
      `Workflow: ${workflowUrl}`,
      `Operator: ${operator}`,
      `Timestamp: ${timestamp}`,
    ].join('\n'),
    allowed_mentions: { parse: [] },
  };
}

export async function sendNotification(options) {
  const url = new URL(options.webhookUrl);
  const local = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  const discord = ['discord.com', 'discordapp.com'].includes(url.hostname);
  if (!(url.protocol === 'https:' && discord) && !(options.allowLocalhost && local)) {
    throw new TypeError('Discord webhook URL is invalid');
  }
  const response = await (options.fetchImpl ?? fetch)(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(buildNotification(options.input)),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Discord notification failed with HTTP ${response.status}`);
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
  await sendNotification({
    webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    input: {
      environment: values.environment,
      status: values.status,
      sourceCommit: values['source-commit'],
      webImage: values['web-image'],
      apiImage: values['api-image'],
      migrationResult: values['migration-result'],
      workflowUrl: values['workflow-url'],
      operator: values.operator,
      timestamp: values.timestamp,
    },
  });
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (entrypoint === import.meta.url) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
