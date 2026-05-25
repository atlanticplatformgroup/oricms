import { OriCmsClientError } from './errors.js';
import type { ApiEnvelope } from './client-types.js';

export type ClientTransportMode = 'management' | 'delivery';

interface ClientTransportContext {
  normalizedApiUrl: string;
  projectId: string;
  mode: ClientTransportMode;
  token?: string;
  headers?: Record<string, string>;
}

interface ClientRequestOptions {
  body?: BodyInit | null;
  failureMessage: string;
  headers?: HeadersInit;
  jsonBody?: unknown;
  method?: string;
  mode?: ClientTransportMode;
  requireManagementTokenMessage?: string;
  retry?: boolean;
}

const MAX_RETRIES = 3;
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isRetryableError(error: unknown, statusCode?: number): boolean {
  if (error instanceof TypeError) return true;
  if (statusCode && RETRYABLE_STATUS_CODES.includes(statusCode)) return true;
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ClientTransport {
  readonly mode: ClientTransportMode;
  assertManagementToken: (message: string) => void;
  requestProjectJson: <T>(path: string, options: ClientRequestOptions) => Promise<T>;
  requestProjectText: (path: string, options: ClientRequestOptions) => Promise<string>;
}

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) {
    return {};
  }
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers };
}

function buildProjectBasePath(projectId: string, mode: ClientTransportMode): string {
  return mode === 'management'
    ? `/api/v1/projects/${projectId}`
    : `/api/v1/delivery/projects/${projectId}`;
}

export function createClientTransport(context: ClientTransportContext): ClientTransport {
  function assertManagementToken(message: string): void {
    if (context.mode !== 'management' || !context.token) {
      throw new OriCmsClientError(message, 'UNAUTHORIZED', 401);
    }
  }

  function createHeaders(mode: ClientTransportMode, options: ClientRequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      ...(context.headers || {}),
      ...normalizeHeaders(options.headers),
    };

    if (options.jsonBody !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (mode === 'management' && context.token) {
      headers.Authorization = `Bearer ${context.token}`;
    }

    return headers;
  }

  async function fetchWithRetry(
    url: string,
    init: RequestInit,
    options: ClientRequestOptions,
  ): Promise<Response> {
    const method = (init.method || 'GET').toUpperCase();
    const shouldRetry = options.retry !== false && IDEMPOTENT_METHODS.has(method);
    const maxAttempts = shouldRetry ? MAX_RETRIES : 1;

    let lastError: unknown;
    let lastStatusCode: number | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(url, init);
        if (!response.ok) {
          lastStatusCode = response.status;
          if (shouldRetry && isRetryableError(null, response.status) && attempt < maxAttempts) {
            const backoff = 1000 * Math.pow(2, attempt - 1);
            const jitter = Math.random() * 500;
            await delay(backoff + jitter);
            continue;
          }
        }
        return response;
      } catch (error) {
        lastError = error;
        if (shouldRetry && isRetryableError(error) && attempt < maxAttempts) {
          const backoff = 1000 * Math.pow(2, attempt - 1);
          const jitter = Math.random() * 500;
          await delay(backoff + jitter);
          continue;
        }
        throw error;
      }
    }

    // If we exhausted retries on a non-ok response, return it for the caller to handle
    if (lastStatusCode !== undefined) {
      return new Response(JSON.stringify({ success: false, error: { message: options.failureMessage, code: 'REQUEST_FAILED' } }), { status: lastStatusCode });
    }

    throw lastError;
  }

  async function requestProjectJson<T>(path: string, options: ClientRequestOptions): Promise<T> {
    const targetMode = options.mode ?? context.mode;
    if (options.requireManagementTokenMessage) {
      assertManagementToken(options.requireManagementTokenMessage);
    }

    const response = await fetchWithRetry(
      `${context.normalizedApiUrl}${buildProjectBasePath(context.projectId, targetMode)}${path}`,
      {
        method: options.method,
        headers: createHeaders(targetMode, options),
        body: options.jsonBody === undefined ? options.body : JSON.stringify(options.jsonBody),
      },
      options,
    );

    const json = await response.json() as ApiEnvelope<T>;
    if (!response.ok || !json.success || json.data === undefined) {
      throw new OriCmsClientError(
        json.error?.message || options.failureMessage,
        json.error?.code || 'REQUEST_FAILED',
        response.status,
      );
    }

    return json.data;
  }

  async function requestProjectText(path: string, options: ClientRequestOptions): Promise<string> {
    const targetMode = options.mode ?? context.mode;
    if (options.requireManagementTokenMessage) {
      assertManagementToken(options.requireManagementTokenMessage);
    }

    const response = await fetchWithRetry(
      `${context.normalizedApiUrl}${buildProjectBasePath(context.projectId, targetMode)}${path}`,
      {
        method: options.method,
        headers: createHeaders(targetMode, options),
        body: options.jsonBody === undefined ? options.body : JSON.stringify(options.jsonBody),
      },
      options,
    );

    if (!response.ok) {
      let message = options.failureMessage;
      let code = 'REQUEST_FAILED';

      try {
        const json = await response.json() as ApiEnvelope<unknown>;
        message = json.error?.message || message;
        code = json.error?.code || code;
      } catch {
        // Ignore non-JSON responses and fall back to the default error.
      }

      throw new OriCmsClientError(message, code, response.status);
    }

    return response.text();
  }

  return {
    mode: context.mode,
    assertManagementToken,
    requestProjectJson,
    requestProjectText,
  };
}
