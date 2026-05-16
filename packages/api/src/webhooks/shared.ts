import crypto from 'crypto';
import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { withLegacyPreviewEnvironment } from '@ori/shared';
import { prisma } from '../lib/prisma';
import { decrypt } from '../lib/crypto';
import { apiServices } from '../lib/api-services';
import { internalError, validationError } from '../lib/responses';
import { resolveWebhookRetryPolicy, type WebhookRetryPolicy } from './retry-policy';
import {
  buildSignedRevalidationHeaders,
  evaluateWebhookUrlPolicy,
  resolveRevalidationAuthMode,
} from './security';
import { dispatchWebhookFailureAlert } from './alerts';

export interface WebhookRequest extends Request {
  rawBody?: Buffer;
}

export interface ProjectEnvironment {
  id: string;
  name?: string;
  buildWebhook?: string;
  revalidationUrl?: string;
  revalidationSecret?: string;
}

export function branchMatchesPattern(branch: string, pattern: string): boolean {
  if (!pattern) return false;
  if (!pattern.includes('*')) return branch === pattern;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(branch);
}

export function extractProjectEnvironments(settings: Prisma.JsonValue | null): ProjectEnvironment[] {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return [];
  const maybeSettings = withLegacyPreviewEnvironment(settings as Record<string, unknown>) as { environments?: unknown };
  if (!Array.isArray(maybeSettings.environments)) return [];
  return maybeSettings.environments
    .filter((env): env is ProjectEnvironment => Boolean(env) && typeof env === 'object' && typeof (env as ProjectEnvironment).id === 'string')
    .map((env) => ({
      id: env.id,
      name: typeof env.name === 'string' ? env.name : undefined,
      buildWebhook: typeof env.buildWebhook === 'string' ? env.buildWebhook : undefined,
      revalidationUrl: typeof env.revalidationUrl === 'string' ? env.revalidationUrl : undefined,
      revalidationSecret: (() => {
        const maybeEncrypted = (env as unknown as { revalidationSecretEncrypted?: unknown }).revalidationSecretEncrypted;
        if (typeof maybeEncrypted === 'string' && maybeEncrypted) {
          try {
            return decrypt(maybeEncrypted);
          } catch (error) {
            throw new Error(`Failed to decrypt revalidation secret for environment ${env.id}: ${error instanceof Error ? error.message : 'unknown error'}`);
          }
        }
        if (typeof env.revalidationSecret === 'string' && env.revalidationSecret.trim().length > 0) {
          throw new Error(`Legacy plaintext revalidationSecret is not supported for environment ${env.id}`);
        }
        return undefined;
      })(),
    }));
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function postJsonWithRetry(
  url: string,
  bodyPayload: unknown,
  headers: Record<string, string>,
  options?: { attempts?: number; timeoutMs?: number; backoffMs?: number; label?: string },
): Promise<{ ok: boolean; status?: number; attempts: number; error?: string; durationMs: number; lastErrorType?: 'timeout' | 'network' | 'http' | 'unknown' }> {
  const startedAt = Date.now();
  const attempts = options?.attempts ?? 3;
  const timeoutMs = options?.timeoutMs ?? 5000;
  const backoffMs = options?.backoffMs ?? 300;
  const label = options?.label || 'webhook';
  let lastErrorType: 'timeout' | 'network' | 'http' | 'unknown' | undefined;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (response.ok) {
        return { ok: true, status: response.status, attempts: attempt, durationMs: Date.now() - startedAt, ...(lastErrorType ? { lastErrorType } : {}) };
      }

      const responseError = `${label} responded ${response.status}`;
      lastErrorType = 'http';
      if (attempt >= attempts) {
        return { ok: false, status: response.status, attempts: attempt, error: responseError, durationMs: Date.now() - startedAt, lastErrorType };
      }
    } catch (error) {
      clearTimeout(timeout);
      const message = error instanceof Error ? error.message : 'Unknown request failure';
      if (error instanceof Error && error.name === 'AbortError') lastErrorType = 'timeout';
      else if (error instanceof Error) lastErrorType = 'network';
      else lastErrorType = 'unknown';
      if (attempt >= attempts) {
        return { ok: false, attempts: attempt, error: message, durationMs: Date.now() - startedAt, lastErrorType };
      }
    }

    await wait(backoffMs * Math.pow(2, attempt - 1));
  }

  return { ok: false, attempts, error: 'Retry exhausted', durationMs: Date.now() - startedAt, ...(lastErrorType ? { lastErrorType } : {}) };
}

export async function writeWebhookTelemetry(
  projectId: string,
  action: 'environment.deploy' | 'environment.revalidate',
  branch: string,
  environmentId: string,
  details: Record<string, unknown>,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      projectId,
      action,
      resourceType: 'environment',
      resourceId: environmentId,
      newValue: {
        branch,
        ...details,
      },
    },
  }).catch((error) => {
    apiServices.logger.warn({ msg: 'Failed to write webhook telemetry audit log', error, projectId, action, branch, environmentId });
  });
}

function safeWebhookHost(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl).host;
  } catch {
    return null;
  }
}

export function logWebhookDispatchFailure(
  action: 'environment.deploy' | 'environment.revalidate',
  projectId: string,
  branch: string,
  environmentId: string,
  endpointUrl: string | undefined,
  response: {
    attempts: number;
    status?: number;
    error?: string;
    durationMs: number;
    lastErrorType?: 'timeout' | 'network' | 'http' | 'unknown' | 'policy';
  },
  policy: WebhookRetryPolicy,
): void {
  const payload = {
    action,
    projectId,
    branch,
    environmentId,
    endpointHost: safeWebhookHost(endpointUrl),
    attempts: response.attempts,
    maxAttempts: policy.attempts,
    timeoutMs: policy.timeoutMs,
    backoffMs: policy.backoffMs,
    durationMs: response.durationMs,
    status: response.status,
    error: response.error,
    errorType: response.lastErrorType,
  };

  apiServices.logger.error({ msg: 'Webhook dispatch failed', ...payload });
  apiServices.runBackgroundTask('webhook-failure-alert', dispatchWebhookFailureAlert(payload));
}

export function deriveRevalidationPaths(changedFiles: string[]): string[] {
  const pagePaths = changedFiles
    .filter((file) => /^content\/pages\//.test(file))
    .map((file) => file.replace(/^content\/pages/, '').replace(/\.(md|markdown|yaml|yml|json)$/i, ''))
    .map((file) => (file === '/index' ? '/' : file || '/'));

  return Array.from(new Set(pagePaths)).slice(0, 200);
}

export function sendValidationError(res: Response, message = 'Invalid webhook payload') {
  validationError(res, message);
}

export function sendInternalError(res: Response, message = 'Failed to process webhook') {
  internalError(res, message);
}

export function buildGitHubSignature(secret: string, payload: Buffer) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export { buildSignedRevalidationHeaders, evaluateWebhookUrlPolicy, resolveRevalidationAuthMode, resolveWebhookRetryPolicy };
