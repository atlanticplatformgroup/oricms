import type { Prisma } from '@prisma/client';
import type { PluginManifest } from '@ori/shared';
import { encrypt, generateToken } from '../lib/crypto';
import {
  buildPluginHealthSnapshot,
  buildPluginUiContributionsSnapshot,
  mergeEnabledPlugins,
  mergePluginExecutionPolicy,
  mergePluginHooksConfig,
  mergePluginSecret,
  mergePluginUiPolicy,
  normalizePluginUiPolicy,
  parseEnabledPlugins,
  parsePluginExecutionPolicy,
  parsePluginHooksConfig,
  parsePluginUiPolicy,
} from './settings';
import { PluginConfigRouteError } from './config-route-common';

export function getRequestedEnabledPluginIds(manifests: PluginManifest[], enabled: string[]) {
  const available = new Set(manifests.map((item) => item.id));
  const requested = enabled.map((item) => item.trim()).filter(Boolean);
  const uniqueRequested = Array.from(new Set(requested));
  const invalid = uniqueRequested.filter((id) => !available.has(id));
  if (invalid.length > 0) {
    throw new PluginConfigRouteError(400, 'PLUGIN_NOT_FOUND', `Unknown plugin ids: ${invalid.join(', ')}`);
  }

  return uniqueRequested;
}

export function resolveHookConfigUpdate(
  settings: unknown,
  manifests: PluginManifest[],
  bodyValue: {
    hookEndpoints?: Record<string, Record<string, string>>;
    retry?: { maxAttempts?: number; baseDelayMs?: number; timeoutMs?: number };
  },
) {
  const current = parsePluginHooksConfig(settings);
  const manifestMap = new Map(manifests.map((manifest) => [manifest.id, manifest]));

  if (bodyValue.hookEndpoints && typeof bodyValue.hookEndpoints === 'object' && !Array.isArray(bodyValue.hookEndpoints)) {
    for (const [pluginId, hooks] of Object.entries(bodyValue.hookEndpoints)) {
      const manifest = manifestMap.get(pluginId);
      if (!manifest) {
        throw new PluginConfigRouteError(400, 'PLUGIN_NOT_FOUND', `Unknown plugin id in hookEndpoints: ${pluginId}`);
      }
      if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) continue;
      const declaredHooks = new Set(manifest.hooks || []);
      for (const event of Object.keys(hooks)) {
        if (!declaredHooks.has(event)) {
          throw new PluginConfigRouteError(
            400,
            'PLUGIN_HOOK_NOT_DECLARED',
            `Plugin "${pluginId}" does not declare hook "${event}"`,
          );
        }
      }
    }
  }

  const hookEndpoints = bodyValue.hookEndpoints && typeof bodyValue.hookEndpoints === 'object'
    ? Object.entries(bodyValue.hookEndpoints).reduce<Record<string, Record<string, string>>>((acc, [pluginId, hooks]) => {
        if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) return acc;
        const mapped: Record<string, string> = {};
        for (const [event, url] of Object.entries(hooks)) {
          if (typeof url === 'string' && url.trim()) mapped[event] = url.trim();
        }
        if (Object.keys(mapped).length > 0) acc[pluginId] = mapped;
        return acc;
      }, {})
    : current.hookEndpoints;

  const retry = {
    maxAttempts: bodyValue.retry?.maxAttempts ?? current.retry.maxAttempts,
    baseDelayMs: bodyValue.retry?.baseDelayMs ?? current.retry.baseDelayMs,
    timeoutMs: bodyValue.retry?.timeoutMs ?? current.retry.timeoutMs,
  };

  return { hookEndpoints, retry };
}

export function resolveReconcilePlan(settings: unknown, manifests: PluginManifest[]) {
  const manifestMap = new Map(manifests.map((manifest) => [manifest.id, manifest]));
  const snapshot = buildPluginHealthSnapshot({ manifests, settings });
  const currentEnabled = parseEnabledPlugins(settings);
  const nextEnabled = currentEnabled.filter((pluginId) => manifestMap.has(pluginId));
  const currentHookConfig = parsePluginHooksConfig(settings);
  const nextHookEndpoints = Object.entries(currentHookConfig.hookEndpoints).reduce<Record<string, Record<string, string>>>((acc, [pluginId, hooks]) => {
    const manifest = manifestMap.get(pluginId);
    if (!manifest) return acc;
    const declaredHooks = new Set(manifest.hooks || []);
    const cleaned = Object.entries(hooks).reduce<Record<string, string>>((eventAcc, [event, endpoint]) => {
      if (declaredHooks.has(event) && endpoint.trim()) eventAcc[event] = endpoint.trim();
      return eventAcc;
    }, {});
    if (Object.keys(cleaned).length > 0) acc[pluginId] = cleaned;
    return acc;
  }, {});

  const changes = {
    removedEnabledPlugins: snapshot.staleEnabledPlugins,
    removedHookEndpoints: snapshot.staleHookEndpoints,
  };
  const hasChanges = changes.removedEnabledPlugins.length > 0 || changes.removedHookEndpoints.length > 0;

  let nextSettings: Prisma.InputJsonValue | null = null;
  if (hasChanges) {
    nextSettings = mergeEnabledPlugins(settings, nextEnabled);
    nextSettings = mergePluginHooksConfig(nextSettings, nextHookEndpoints, currentHookConfig.retry);
  }

  return { changes, hasChanges, nextSettings };
}

export function buildRotatedPluginSecret(settings: unknown, pluginId: string) {
  const plaintextSecret = `phs_${generateToken(24)}`;
  const secretPrefix = plaintextSecret.slice(0, 12);
  const rotatedAt = new Date().toISOString();
  const nextSettings = mergePluginSecret(settings, pluginId, {
    encryptedSecret: encrypt(plaintextSecret),
    secretPrefix,
    rotatedAt,
  });

  return {
    nextSettings,
    response: {
      pluginId,
      secret: plaintextSecret,
      secretPrefix,
      rotatedAt,
    },
  };
}

export function resolveExecutionPolicyUpdate(
  settings: unknown,
  bodyValue: Partial<ReturnType<typeof parsePluginExecutionPolicy>>,
) {
  const current = parsePluginExecutionPolicy(settings);
  const next = {
    mode: bodyValue.mode === 'disabled' ? 'disabled' as const : (bodyValue.mode === 'webhook-only' ? 'webhook-only' as const : current.mode),
    enforceManifestCapabilities: typeof bodyValue.enforceManifestCapabilities === 'boolean'
      ? bodyValue.enforceManifestCapabilities
      : current.enforceManifestCapabilities,
    allowlistedHooks: Array.isArray(bodyValue.allowlistedHooks)
      ? bodyValue.allowlistedHooks.map((item) => item.trim()).filter(Boolean)
      : current.allowlistedHooks,
    blockedPlugins: Array.isArray(bodyValue.blockedPlugins)
      ? bodyValue.blockedPlugins.map((item) => item.trim()).filter(Boolean)
      : current.blockedPlugins,
  };

  return {
    current,
    next,
    nextSettings: mergePluginExecutionPolicy(settings, next),
  };
}

export function resolveUiPolicyUpdate(
  settings: unknown,
  bodyValue: Partial<ReturnType<typeof parsePluginUiPolicy>>,
) {
  const current = parsePluginUiPolicy(settings);
  const normalized = normalizePluginUiPolicy({
    includeDisabledPlugins: bodyValue.includeDisabledPlugins,
    allowlistedViews: bodyValue.allowlistedViews,
    allowlistedFieldTypes: bodyValue.allowlistedFieldTypes,
  });
  const next = {
    includeDisabledPlugins: typeof bodyValue.includeDisabledPlugins === 'boolean'
      ? normalized.includeDisabledPlugins
      : current.includeDisabledPlugins,
    allowlistedViews: Array.isArray(bodyValue.allowlistedViews) ? normalized.allowlistedViews : current.allowlistedViews,
    allowlistedFieldTypes: Array.isArray(bodyValue.allowlistedFieldTypes)
      ? normalized.allowlistedFieldTypes
      : current.allowlistedFieldTypes,
  };

  return {
    current,
    next,
    nextSettings: mergePluginUiPolicy(settings, next),
  };
}

export function resolveUiPolicyPreview(
  settings: unknown,
  manifests: PluginManifest[],
  bodyValue: Partial<ReturnType<typeof parsePluginUiPolicy>>,
) {
  const currentPolicy = parsePluginUiPolicy(settings);
  const normalized = normalizePluginUiPolicy(bodyValue);
  const previewPolicy = {
    includeDisabledPlugins: typeof bodyValue.includeDisabledPlugins === 'boolean'
      ? bodyValue.includeDisabledPlugins
      : currentPolicy.includeDisabledPlugins,
    allowlistedViews: Array.isArray(bodyValue.allowlistedViews) ? normalized.allowlistedViews : currentPolicy.allowlistedViews,
    allowlistedFieldTypes: Array.isArray(bodyValue.allowlistedFieldTypes)
      ? normalized.allowlistedFieldTypes
      : currentPolicy.allowlistedFieldTypes,
  };

  return {
    currentPolicy,
    previewPolicy,
    current: buildPluginUiContributionsSnapshot({
      manifests,
      settings,
      uiPolicyOverride: currentPolicy,
    }),
    preview: buildPluginUiContributionsSnapshot({
      manifests,
      settings,
      uiPolicyOverride: previewPolicy,
    }),
  };
}
