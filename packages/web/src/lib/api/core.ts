import type { ApiResponse } from '@ori/shared';

export const API_BASE_URL = (import.meta as unknown as { env: { VITE_API_URL: string } }).env.VITE_API_URL || 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  requiresAuth?: boolean;
  retry?: boolean;
  retryCount?: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const RETRYABLE_STATUS_CODES = [408, 500, 502, 503, 504];
const ACCESS_TOKEN_REFRESH_BUFFER_SECONDS = 15;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown, statusCode?: number): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) return true;
  if (statusCode && RETRYABLE_STATUS_CODES.includes(statusCode)) return true;
  return false;
}

function decodeJwtPayload(token: string): { exp?: number } | null {
  const segments = token.split('.');
  if (segments.length < 2) return null;

  try {
    const normalized = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const json = atob(padded);
    return JSON.parse(json) as { exp?: number };
  } catch {
    return null;
  }
}

function tokenNeedsRefresh(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;

  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= nowSeconds + ACCESS_TOKEN_REFRESH_BUFFER_SECONDS;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data: ApiResponse<{ accessToken: string; refreshToken: string }> = await response.json();

      if (data.success && data.data) {
        return data.data.accessToken;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    } finally {
      refreshPromise = null;
    }

    return null;
  })();

  return refreshPromise;
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    requiresAuth = true,
    retry = true,
    retryCount = MAX_RETRIES,
  } = options;

  const url = `${API_BASE_URL}${endpoint}`;

  const makeRequest = async (token?: string): Promise<T> => {
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (requiresAuth && token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });

    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError(`Invalid JSON from ${endpoint} (${response.status}): ${text.slice(0, 100)}...`, 'PARSE_ERROR', response.status);
    }

    if (!data.success) {
      console.error(`[API] Request to ${endpoint} failed with status ${response.status}:`, data.error);
      throw new ApiError(
        data.error?.message || `Request to ${endpoint} failed`,
        data.error?.code || 'UNKNOWN_ERROR',
        response.status,
        data.error?.details,
      );
    }

    return data.data as T;
  };

  let lastError: unknown;
  let lastStatusCode: number | undefined;
  let tokenRefreshed = false;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      if (requiresAuth) {
        // With cookie-based auth, the browser sends cookies automatically.
        // We only need to handle token refresh proactively when the access
        // token cookie is about to expire.
        const cachedToken = localStorage.getItem('accessToken');
        if (cachedToken && tokenNeedsRefresh(cachedToken)) {
          const newToken = await refreshAccessToken();
          if (newToken) {
            tokenRefreshed = true;
          }
        }
      }

      return await makeRequest();
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError) {
        lastStatusCode = error.statusCode;
      }

      if (lastStatusCode === 401 && requiresAuth && !tokenRefreshed) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          tokenRefreshed = true;
          attempt -= 1;
          continue;
        }

        localStorage.removeItem('user');
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        throw new ApiError('Session expired', 'UNAUTHORIZED', 401);
      }

      if (!retry || attempt === retryCount) break;
      if (!isRetryableError(error, lastStatusCode)) break;

      const backoffDelay = RETRY_DELAY_MS * Math.pow(2, attempt);
      const jitter = Math.random() * 1000;
      const totalDelay = backoffDelay + jitter;

      console.warn(`API request failed (attempt ${attempt + 1}/${retryCount + 1}), retrying in ${Math.round(totalDelay)}ms...`, error);
      await delay(totalDelay);
    }
  }

  throw lastError;
}
