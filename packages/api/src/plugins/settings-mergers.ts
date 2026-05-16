import type { Prisma } from '@prisma/client';

function createSettingsRecord(settings: unknown): Record<string, unknown> {
  return settings && typeof settings === 'object' && !Array.isArray(settings)
    ? { ...(settings as Record<string, unknown>) }
    : {};
}

function createPluginsRecord(settingsRecord: Record<string, unknown>): Record<string, unknown> {
  return settingsRecord.plugins &&
    typeof settingsRecord.plugins === 'object' &&
    !Array.isArray(settingsRecord.plugins)
    ? { ...(settingsRecord.plugins as Record<string, unknown>) }
    : {};
}

export function mergeEnabledPlugins(settings: unknown, enabledPluginIds: string[]): Prisma.InputJsonValue {
  const settingsRecord = createSettingsRecord(settings);
  const plugins = createPluginsRecord(settingsRecord);
  plugins.enabled = enabledPluginIds;
  settingsRecord.plugins = plugins;
  return settingsRecord as Prisma.InputJsonValue;
}

export function mergePluginHooksConfig(
  settings: unknown,
  hookEndpoints: Record<string, Record<string, string>>,
  retry: { maxAttempts: number; baseDelayMs: number; timeoutMs: number },
): Prisma.InputJsonValue {
  const settingsRecord = createSettingsRecord(settings);
  const plugins = createPluginsRecord(settingsRecord);
  plugins.hookEndpoints = hookEndpoints;
  plugins.retry = retry;
  settingsRecord.plugins = plugins;
  return settingsRecord as Prisma.InputJsonValue;
}

export function mergePluginSecret(
  settings: unknown,
  pluginId: string,
  secretValue: { encryptedSecret: string; secretPrefix: string; rotatedAt: string } | null,
): Prisma.InputJsonValue {
  const settingsRecord = createSettingsRecord(settings);
  const plugins = createPluginsRecord(settingsRecord);
  const secrets =
    plugins.secrets && typeof plugins.secrets === 'object' && !Array.isArray(plugins.secrets)
      ? { ...(plugins.secrets as Record<string, unknown>) }
      : {};

  if (secretValue) {
    secrets[pluginId] = secretValue;
  } else {
    delete secrets[pluginId];
  }

  plugins.secrets = secrets;
  settingsRecord.plugins = plugins;
  return settingsRecord as Prisma.InputJsonValue;
}

export function mergePluginExecutionPolicy(
  settings: unknown,
  policy: {
    mode: 'disabled' | 'webhook-only';
    enforceManifestCapabilities: boolean;
    allowlistedHooks: string[];
    blockedPlugins: string[];
  },
): Prisma.InputJsonValue {
  const settingsRecord = createSettingsRecord(settings);
  const plugins = createPluginsRecord(settingsRecord);
  plugins.executionPolicy = policy;
  settingsRecord.plugins = plugins;
  return settingsRecord as Prisma.InputJsonValue;
}

export function mergePluginUiPolicy(
  settings: unknown,
  policy: {
    includeDisabledPlugins: boolean;
    allowlistedViews: string[];
    allowlistedFieldTypes: string[];
  },
): Prisma.InputJsonValue {
  const settingsRecord = createSettingsRecord(settings);
  const plugins = createPluginsRecord(settingsRecord);
  plugins.uiPolicy = policy;
  settingsRecord.plugins = plugins;
  return settingsRecord as Prisma.InputJsonValue;
}
