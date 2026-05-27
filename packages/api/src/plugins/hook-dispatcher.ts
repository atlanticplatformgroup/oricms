import crypto from 'crypto';
import { ALLOWED_PLUGIN_HOOKS, type PluginEventName } from '@ori/shared';
import { prisma } from '../lib/prisma';
import { decrypt } from '../lib/crypto';
import { PluginRegistryService } from './service';

export interface PluginHookDispatchInput {
  projectId: string;
  event: PluginEventName;
  resourceType: string;
  resourceId?: string;
  payload: Record<string, unknown>;
  actor?: {
    id?: string;
    name?: string;
    email?: string;
  };
}

interface PluginRetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  timeoutMs: number;
}

interface PluginHookConfig {
  executionPolicy: {
    mode: 'disabled' | 'webhook-only';
    enforceManifestCapabilities: boolean;
    allowlistedHooks: string[];
    blockedPlugins: string[];
  };
  enabled: string[];
  hookEndpoints: Record<string, Record<string, string>>;
  secrets: Record<string, { encryptedSecret: string; secretPrefix: string; rotatedAt: string }>;
  retry: PluginRetryConfig;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseHookConfig(settings: unknown): PluginHookConfig {
  const defaultRetry: PluginRetryConfig = {
    maxAttempts: 3,
    baseDelayMs: process.env.NODE_ENV === 'test' ? 1 : 300,
    timeoutMs: 6000,
  };
  const defaultExecutionPolicy: PluginHookConfig['executionPolicy'] = {
    mode: 'webhook-only',
    enforceManifestCapabilities: true,
    allowlistedHooks: [],
    blockedPlugins: [],
  };
  if (!isRecord(settings) || !isRecord(settings.plugins)) {
    return { executionPolicy: defaultExecutionPolicy, enabled: [], hookEndpoints: {}, secrets: {}, retry: defaultRetry };
  }

  const plugins = settings.plugins;
  const enabled = Array.isArray(plugins.enabled)
    ? plugins.enabled.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : [];

  const hookEndpoints: Record<string, Record<string, string>> = {};
  if (isRecord(plugins.hookEndpoints)) {
    for (const [pluginId, rawHooks] of Object.entries(plugins.hookEndpoints)) {
      if (!isRecord(rawHooks)) continue;
      const mapped: Record<string, string> = {};
      for (const [event, value] of Object.entries(rawHooks)) {
        if (typeof value === 'string' && value.trim()) {
          mapped[event] = value.trim();
        }
      }
      if (Object.keys(mapped).length > 0) {
        hookEndpoints[pluginId] = mapped;
      }
    }
  }

  const secrets: Record<string, { encryptedSecret: string; secretPrefix: string; rotatedAt: string }> = {};
  if (isRecord(plugins.secrets)) {
    for (const [pluginId, rawSecret] of Object.entries(plugins.secrets)) {
      if (!isRecord(rawSecret)) continue;
      if (
        typeof rawSecret.encryptedSecret === 'string'
        && typeof rawSecret.secretPrefix === 'string'
        && typeof rawSecret.rotatedAt === 'string'
      ) {
        secrets[pluginId] = {
          encryptedSecret: rawSecret.encryptedSecret,
          secretPrefix: rawSecret.secretPrefix,
          rotatedAt: rawSecret.rotatedAt,
        };
      }
    }
  }

  const retry = isRecord(plugins.retry)
    ? {
      maxAttempts: typeof plugins.retry.maxAttempts === 'number' ? Math.min(Math.max(Math.floor(plugins.retry.maxAttempts), 1), 10) : defaultRetry.maxAttempts,
      baseDelayMs: typeof plugins.retry.baseDelayMs === 'number' ? Math.min(Math.max(Math.floor(plugins.retry.baseDelayMs), 1), 60_000) : defaultRetry.baseDelayMs,
      timeoutMs: typeof plugins.retry.timeoutMs === 'number' ? Math.min(Math.max(Math.floor(plugins.retry.timeoutMs), 100), 60_000) : defaultRetry.timeoutMs,
    }
    : defaultRetry;

  const executionPolicy = isRecord(plugins.executionPolicy)
    ? {
      mode: plugins.executionPolicy.mode === 'disabled' ? 'disabled' as const : 'webhook-only' as const,
      enforceManifestCapabilities: plugins.executionPolicy.enforceManifestCapabilities !== false,
      allowlistedHooks: Array.isArray(plugins.executionPolicy.allowlistedHooks)
        ? plugins.executionPolicy.allowlistedHooks.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
        : [],
      blockedPlugins: Array.isArray(plugins.executionPolicy.blockedPlugins)
        ? plugins.executionPolicy.blockedPlugins.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
        : [],
    }
    : defaultExecutionPolicy;

  return { executionPolicy, enabled, hookEndpoints, secrets, retry };
}

function isSafeWebhookUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:') return true;
    const localHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    return parsed.protocol === 'http:' && localHost && process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postWithRetry(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string>,
  retry: PluginRetryConfig
): Promise<{ attempts: number }> {
  let attempts = 0;
  let lastError: unknown;

  for (attempts = 1; attempts <= retry.maxAttempts; attempts += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), retry.timeoutMs);
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        throw new Error(`Hook endpoint returned ${response.status}`);
      }
      return { attempts };
    } catch (error) {
      lastError = error;
      if (attempts < retry.maxAttempts) {
        const delayMs = retry.baseDelayMs * Math.pow(2, attempts - 1);
        await wait(delayMs);
      }
    }
  }

  throw (lastError instanceof Error ? lastError : new Error('Hook dispatch failed'));
}

export async function dispatchPluginHook(input: PluginHookDispatchInput): Promise<{ sent: number; failed: number; skipped: number }> {
  if (!ALLOWED_PLUGIN_HOOKS.has(input.event)) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { id: true, name: true, repoUrl: true, defaultBranch: true, settings: true },
  });
  if (!project) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const config = parseHookConfig(project.settings);
  if (config.executionPolicy.mode === 'disabled') {
    return { sent: 0, failed: 0, skipped: config.enabled.length };
  }
  if (config.executionPolicy.allowlistedHooks.length > 0 && !config.executionPolicy.allowlistedHooks.includes(input.event)) {
    return { sent: 0, failed: 0, skipped: config.enabled.length };
  }
  if (config.enabled.length === 0) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const registry = new PluginRegistryService();
  const manifests = await registry.list(project.id, project.repoUrl ?? '', project.defaultBranch);
  const manifestMap = new Map(manifests.map((manifest) => [manifest.id, manifest]));

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const pluginId of config.enabled) {
    if (config.executionPolicy.blockedPlugins.includes(pluginId)) {
      skipped += 1;
      continue;
    }

    const manifest = manifestMap.get(pluginId);
    if (!manifest) {
      skipped += 1;
      continue;
    }

    if (
      config.executionPolicy.enforceManifestCapabilities
      && !(manifest.capabilities?.webhooks === true)
    ) {
      skipped += 1;
      continue;
    }

    const declaresHook = Array.isArray(manifest.hooks) && manifest.hooks.includes(input.event);
    if (!declaresHook) {
      skipped += 1;
      continue;
    }

    const endpoint = config.hookEndpoints[pluginId]?.[input.event];
    if (!endpoint || !isSafeWebhookUrl(endpoint)) {
      skipped += 1;
      continue;
    }

    const body = {
      hook: input.event,
      pluginId,
      project: {
        id: project.id,
        name: project.name,
      },
      actor: input.actor || null,
      resource: {
        type: input.resourceType,
        id: input.resourceId || null,
      },
      payload: input.payload,
      timestamp: new Date().toISOString(),
    };
    const serializedBody = JSON.stringify(body);
    const secretRef = config.secrets[pluginId];
    if (!secretRef) {
      skipped += 1;
      continue;
    }

    let secret: string;
    try {
      secret = decrypt(secretRef.encryptedSecret);
    } catch {
      failed += 1;
      await prisma.auditLog.create({
        data: {
          projectId: input.projectId,
          userId: input.actor?.id || null,
          action: 'plugin.hook.failed',
          resourceType: input.resourceType,
          resourceId: input.resourceId || null,
          newValue: {
            event: input.event,
            pluginId,
            endpoint,
            error: 'Failed to decrypt plugin hook secret',
          },
        },
      });
      continue;
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(12).toString('hex');
    const hookId = crypto.randomUUID();
    const signedPayload = `${timestamp}.${nonce}.${serializedBody}`;
    const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
    const headers = {
      'Content-Type': 'application/json',
      'X-OriCMS-Hook-Id': hookId,
      'X-OriCMS-Hook-Timestamp': timestamp,
      'X-OriCMS-Hook-Nonce': nonce,
      'X-OriCMS-Hook-Signature': `sha256=${signature}`,
      'X-OriCMS-Hook-Secret-Prefix': secretRef.secretPrefix,
      'X-OriCMS-Hook-Replay-Window': '300',
    };

    try {
      const result = await postWithRetry(endpoint, body, headers, config.retry);
      sent += 1;
      await prisma.auditLog.create({
        data: {
          projectId: input.projectId,
          userId: input.actor?.id || null,
          action: 'plugin.hook.sent',
          resourceType: input.resourceType,
          resourceId: input.resourceId || null,
          newValue: {
            event: input.event,
            pluginId,
            endpoint,
            hookId,
            secretPrefix: secretRef.secretPrefix,
            attempts: result.attempts,
          },
        },
      });
    } catch (error) {
      failed += 1;
      await prisma.auditLog.create({
        data: {
          projectId: input.projectId,
          userId: input.actor?.id || null,
          action: 'plugin.hook.failed',
          resourceType: input.resourceType,
          resourceId: input.resourceId || null,
          newValue: {
            event: input.event,
            pluginId,
            endpoint,
            hookId,
            secretPrefix: secretRef.secretPrefix,
            error: error instanceof Error ? error.message : 'Hook dispatch failed',
          },
        },
      });
    }
  }

  return { sent, failed, skipped };
}
