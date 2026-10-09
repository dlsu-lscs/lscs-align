import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

const environments = ['development', 'staging', 'production'] as const;
const revisionPattern = /^[0-9a-f]{40}$/;
const requestIdPattern = /^[A-Za-z0-9._-]{1,128}$/;

export type AppEnvironment = (typeof environments)[number];

export interface WebConfig {
  environment: AppEnvironment;
  host: string;
  port: number;
  revision: string;
}

export interface RequestLog {
  timestamp: string;
  environment: AppEnvironment;
  service: 'web';
  revision: string;
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  errorCode: string | null;
}

interface WebServerOptions {
  environment: AppEnvironment;
  revision: string;
  logger?: (record: RequestLog) => void;
}

function parseEnvironment(value: string | undefined): AppEnvironment {
  if (!value || !environments.includes(value as AppEnvironment)) {
    throw new Error('APP_ENV must be development, staging, or production');
  }
  return value as AppEnvironment;
}

function parsePort(value: string | undefined, variable: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${variable} must be an integer from 1 to 65535`);
  }
  return port;
}

function parseRevision(value: string | undefined): string {
  if (!value || !revisionPattern.test(value)) {
    throw new Error('SOURCE_COMMIT must be a 40-character lowercase hexadecimal SHA');
  }
  return value;
}

export function loadWebConfig(environment: NodeJS.ProcessEnv): WebConfig {
  return {
    environment: parseEnvironment(environment.APP_ENV),
    host: environment.WEB_HOST?.trim() || '0.0.0.0',
    port: parsePort(environment.WEB_PORT, 'WEB_PORT'),
    revision: parseRevision(environment.SOURCE_COMMIT),
  };
}

function setSecurityHeaders(response: ServerResponse, requestId: string): void {
  response.setHeader('cache-control', 'no-store');
  response.setHeader('content-security-policy', "default-src 'self'; frame-ancestors 'none'");
  response.setHeader('permissions-policy', 'camera=(), geolocation=(), microphone=()');
  response.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('x-frame-options', 'DENY');
  response.setHeader('x-request-id', requestId);
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

function requestIdFor(request: IncomingMessage): string {
  const candidate = request.headers['x-request-id'];
  return typeof candidate === 'string' && requestIdPattern.test(candidate)
    ? candidate
    : randomUUID();
}

function writeDefaultLog(record: RequestLog): void {
  process.stdout.write(`${JSON.stringify(record)}\n`);
}

export function createWebServer(options: WebServerOptions): Server {
  const logger = options.logger ?? writeDefaultLog;

  return createServer((request, response) => {
    const startedAt = process.hrtime.bigint();
    const requestId = requestIdFor(request);
    const method = request.method ?? 'UNKNOWN';
    const route = new URL(request.url ?? '/', 'http://localhost').pathname;
    let errorCode: string | null = null;

    setSecurityHeaders(response, requestId);
    response.once('finish', () => {
      logger({
        timestamp: new Date().toISOString(),
        environment: options.environment,
        service: 'web',
        revision: options.revision,
        requestId,
        method,
        route,
        status: response.statusCode,
        durationMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
        errorCode,
      });
    });

    if (method !== 'GET') {
      errorCode = 'method_not_allowed';
      response.setHeader('allow', 'GET');
      sendJson(response, 405, { error: errorCode });
      return;
    }

    if (route === '/healthz') {
      sendJson(response, 200, { status: 'ok', service: 'web' });
      return;
    }

    if (route === '/revision.json') {
      sendJson(response, 200, {
        service: 'web',
        environment: options.environment,
        sourceCommit: options.revision,
      });
      return;
    }

    if (route === '/') {
      response.statusCode = 200;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end(
        '<!doctype html><html lang="en"><title>LSCS Align</title><h1>LSCS Align</h1></html>',
      );
      return;
    }

    errorCode = 'not_found';
    sendJson(response, 404, { error: errorCode });
  });
}
