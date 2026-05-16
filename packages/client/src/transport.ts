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

  async function requestProjectJson<T>(path: string, options: ClientRequestOptions): Promise<T> {
    const targetMode = options.mode ?? context.mode;
    if (options.requireManagementTokenMessage) {
      assertManagementToken(options.requireManagementTokenMessage);
    }

    const response = await fetch(`${context.normalizedApiUrl}${buildProjectBasePath(context.projectId, targetMode)}${path}`, {
      method: options.method,
      headers: createHeaders(targetMode, options),
      body: options.jsonBody === undefined ? options.body : JSON.stringify(options.jsonBody),
    });

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

    const response = await fetch(`${context.normalizedApiUrl}${buildProjectBasePath(context.projectId, targetMode)}${path}`, {
      method: options.method,
      headers: createHeaders(targetMode, options),
      body: options.jsonBody === undefined ? options.body : JSON.stringify(options.jsonBody),
    });

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
