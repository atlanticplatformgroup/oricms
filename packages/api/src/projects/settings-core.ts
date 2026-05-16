import type { Prisma } from '@prisma/client';
import { normalizeProjectSettingsForStorage, withLegacyPreviewEnvironment } from '@ori/shared';
import { encrypt } from '../lib/crypto';

const allowFileRepoUrls = process.env.ALLOW_FILE_REPO_URLS === 'true' || process.env.NODE_ENV === 'test';

export interface ProjectEnvironment {
  id: string;
  name?: string;
  type?: string;
  buildWebhook?: string;
  revalidationUrl?: string;
}

export function isValidRepoUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;

  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return true;
    if (parsed.protocol === 'file:' && allowFileRepoUrls) return true;
    return false;
  } catch {
    return false;
  }
}

export function extractProjectEnvironments(settings: Prisma.JsonValue | null): ProjectEnvironment[] {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return [];
  }

  const maybeSettings = withLegacyPreviewEnvironment(settings as Record<string, unknown>) as { environments?: unknown };
  if (!Array.isArray(maybeSettings.environments)) {
    return [];
  }

  return maybeSettings.environments
    .filter((env): env is ProjectEnvironment => Boolean(env) && typeof env === 'object' && typeof (env as ProjectEnvironment).id === 'string')
    .map((env) => ({
      id: env.id,
      name: typeof env.name === 'string' ? env.name : undefined,
      type: typeof env.type === 'string' ? env.type : undefined,
      buildWebhook: typeof env.buildWebhook === 'string' ? env.buildWebhook : undefined,
      revalidationUrl: typeof env.revalidationUrl === 'string' ? env.revalidationUrl : undefined,
    }));
}

function extractRawEnvironments(settings: unknown): Array<Record<string, unknown>> {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return [];
  const maybeSettings = settings as { environments?: unknown };
  if (!Array.isArray(maybeSettings.environments)) return [];
  return maybeSettings.environments
    .filter((env) => Boolean(env) && typeof env === 'object' && !Array.isArray(env))
    .map((env) => ({ ...(env as Record<string, unknown>) }));
}

export function sanitizeSettingsForStorage(
  nextSettings: Record<string, unknown>,
  existingSettings: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = normalizeProjectSettingsForStorage(nextSettings);
  delete sanitized.starter;
  const incomingEnvironments = extractRawEnvironments(nextSettings);
  if (incomingEnvironments.length === 0) return sanitized;

  const existingEnvironmentsById = new Map(
    extractRawEnvironments(existingSettings)
      .filter((env) => typeof env.id === 'string')
      .map((env) => [String(env.id), env]),
  );

  const encryptedEnvironments = incomingEnvironments.map((env) => {
    const envId = typeof env.id === 'string' ? env.id : '';
    const existing = existingEnvironmentsById.get(envId);
    const nextEnv: Record<string, unknown> = { ...env };

    const incomingSecret = typeof env.revalidationSecret === 'string' ? env.revalidationSecret : undefined;
    if ('revalidationSecretEncrypted' in env) {
      throw new Error('revalidationSecretEncrypted is managed by the server and must not be provided in settings payload');
    }
    if (typeof existing?.revalidationSecret === 'string' && existing.revalidationSecret.trim().length > 0) {
      throw new Error('Legacy plaintext revalidationSecret detected in project settings. Clear and re-save the secret.');
    }
    const existingEncrypted = typeof existing?.revalidationSecretEncrypted === 'string'
      ? existing.revalidationSecretEncrypted
      : undefined;

    if (incomingSecret && incomingSecret.trim().length > 0) {
      nextEnv.revalidationSecretEncrypted = encrypt(incomingSecret.trim());
    } else if (incomingSecret !== undefined) {
      delete nextEnv.revalidationSecretEncrypted;
    } else if (existingEncrypted) {
      nextEnv.revalidationSecretEncrypted = existingEncrypted;
    }

    delete nextEnv.revalidationSecret;
    return nextEnv;
  });

  sanitized.environments = encryptedEnvironments;
  return sanitized;
}
