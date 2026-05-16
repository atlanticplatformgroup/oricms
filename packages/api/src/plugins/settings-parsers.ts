export function parseQueryInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

export function parseEnabledPlugins(settings: unknown): string[] {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return [];
  }
  const settingsRecord = settings as Record<string, unknown>;
  const plugins = settingsRecord.plugins;
  if (!plugins || typeof plugins !== 'object' || Array.isArray(plugins)) {
    return [];
  }
  const enabled = (plugins as Record<string, unknown>).enabled;
  if (!Array.isArray(enabled)) {
    return [];
  }
  return enabled
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parsePluginHooksConfig(settings: unknown): {
  hookEndpoints: Record<string, Record<string, string>>;
  retry: { maxAttempts: number; baseDelayMs: number; timeoutMs: number };
} {
  const defaults: {
    hookEndpoints: Record<string, Record<string, string>>;
    retry: { maxAttempts: number; baseDelayMs: number; timeoutMs: number };
  } = {
    hookEndpoints: {},
    retry: {
      maxAttempts: 3,
      baseDelayMs: process.env.NODE_ENV === 'test' ? 1 : 300,
      timeoutMs: 6000,
    },
  };
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return defaults;
  }
  const settingsRecord = settings as Record<string, unknown>;
  const plugins = settingsRecord.plugins;
  if (!plugins || typeof plugins !== 'object' || Array.isArray(plugins)) {
    return defaults;
  }
  const pluginRecord = plugins as Record<string, unknown>;

  if (
    pluginRecord.hookEndpoints &&
    typeof pluginRecord.hookEndpoints === 'object' &&
    !Array.isArray(pluginRecord.hookEndpoints)
  ) {
    for (const [pluginId, rawHooks] of Object.entries(
      pluginRecord.hookEndpoints as Record<string, unknown>,
    )) {
      if (!rawHooks || typeof rawHooks !== 'object' || Array.isArray(rawHooks)) {
        continue;
      }
      const hooks: Record<string, string> = {};
      for (const [event, value] of Object.entries(rawHooks as Record<string, unknown>)) {
        if (typeof value === 'string' && value.trim()) {
          hooks[event] = value.trim();
        }
      }
      if (Object.keys(hooks).length > 0) {
        defaults.hookEndpoints[pluginId] = hooks;
      }
    }
  }

  if (pluginRecord.retry && typeof pluginRecord.retry === 'object' && !Array.isArray(pluginRecord.retry)) {
    const retry = pluginRecord.retry as Record<string, unknown>;
    if (typeof retry.maxAttempts === 'number') {
      defaults.retry.maxAttempts = Math.min(Math.max(Math.floor(retry.maxAttempts), 1), 10);
    }
    if (typeof retry.baseDelayMs === 'number') {
      defaults.retry.baseDelayMs = Math.min(Math.max(Math.floor(retry.baseDelayMs), 1), 60000);
    }
    if (typeof retry.timeoutMs === 'number') {
      defaults.retry.timeoutMs = Math.min(Math.max(Math.floor(retry.timeoutMs), 100), 60000);
    }
  }

  return defaults;
}

export function parsePluginSecretMetadata(
  settings: unknown,
): Array<{ pluginId: string; secretPrefix: string; rotatedAt: string }> {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return [];
  }
  const settingsRecord = settings as Record<string, unknown>;
  const plugins = settingsRecord.plugins;
  if (!plugins || typeof plugins !== 'object' || Array.isArray(plugins)) {
    return [];
  }
  const pluginRecord = plugins as Record<string, unknown>;
  const secrets = pluginRecord.secrets;
  if (!secrets || typeof secrets !== 'object' || Array.isArray(secrets)) {
    return [];
  }

  const metadata: Array<{ pluginId: string; secretPrefix: string; rotatedAt: string }> = [];
  for (const [pluginId, value] of Object.entries(secrets as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    const entry = value as Record<string, unknown>;
    if (typeof entry.secretPrefix === 'string' && typeof entry.rotatedAt === 'string') {
      metadata.push({ pluginId, secretPrefix: entry.secretPrefix, rotatedAt: entry.rotatedAt });
    }
  }
  metadata.sort((a, b) => a.pluginId.localeCompare(b.pluginId));
  return metadata;
}

export function parsePluginExecutionPolicy(settings: unknown): {
  mode: 'disabled' | 'webhook-only';
  enforceManifestCapabilities: boolean;
  allowlistedHooks: string[];
  blockedPlugins: string[];
} {
  const defaults = {
    mode: 'webhook-only' as const,
    enforceManifestCapabilities: true,
    allowlistedHooks: [] as string[],
    blockedPlugins: [] as string[],
  };
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return defaults;
  }
  const settingsRecord = settings as Record<string, unknown>;
  const plugins = settingsRecord.plugins;
  if (!plugins || typeof plugins !== 'object' || Array.isArray(plugins)) {
    return defaults;
  }
  const pluginRecord = plugins as Record<string, unknown>;
  const policy = pluginRecord.executionPolicy;
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    return defaults;
  }
  const record = policy as Record<string, unknown>;
  return {
    mode: record.mode === 'disabled' ? 'disabled' : 'webhook-only',
    enforceManifestCapabilities: record.enforceManifestCapabilities !== false,
    allowlistedHooks: Array.isArray(record.allowlistedHooks)
      ? record.allowlistedHooks
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
    blockedPlugins: Array.isArray(record.blockedPlugins)
      ? record.blockedPlugins
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
  };
}

export function normalizeExecutionPolicy(
  input: unknown,
  fallback: ReturnType<typeof parsePluginExecutionPolicy>,
) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fallback;
  }
  const record = input as Record<string, unknown>;
  return {
    mode:
      record.mode === 'disabled'
        ? ('disabled' as const)
        : record.mode === 'webhook-only'
          ? ('webhook-only' as const)
          : fallback.mode,
    enforceManifestCapabilities:
      typeof record.enforceManifestCapabilities === 'boolean'
        ? record.enforceManifestCapabilities
        : fallback.enforceManifestCapabilities,
    allowlistedHooks: Array.isArray(record.allowlistedHooks)
      ? record.allowlistedHooks
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean)
      : fallback.allowlistedHooks,
    blockedPlugins: Array.isArray(record.blockedPlugins)
      ? record.blockedPlugins
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean)
      : fallback.blockedPlugins,
  };
}

export function parsePluginUiPolicy(settings: unknown): {
  includeDisabledPlugins: boolean;
  allowlistedViews: string[];
  allowlistedFieldTypes: string[];
} {
  const defaults = {
    includeDisabledPlugins: false,
    allowlistedViews: [] as string[],
    allowlistedFieldTypes: [] as string[],
  };
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return defaults;
  }
  const settingsRecord = settings as Record<string, unknown>;
  const plugins = settingsRecord.plugins;
  if (!plugins || typeof plugins !== 'object' || Array.isArray(plugins)) {
    return defaults;
  }
  const pluginRecord = plugins as Record<string, unknown>;
  const policy = pluginRecord.uiPolicy;
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    return defaults;
  }
  const record = policy as Record<string, unknown>;
  return {
    includeDisabledPlugins: record.includeDisabledPlugins === true,
    allowlistedViews: Array.isArray(record.allowlistedViews)
      ? record.allowlistedViews
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
    allowlistedFieldTypes: Array.isArray(record.allowlistedFieldTypes)
      ? record.allowlistedFieldTypes
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
  };
}

export function normalizePluginUiPolicy(input: Partial<{
  includeDisabledPlugins: boolean;
  allowlistedViews: string[];
  allowlistedFieldTypes: string[];
}>) {
  return {
    includeDisabledPlugins: input.includeDisabledPlugins === true,
    allowlistedViews: Array.isArray(input.allowlistedViews)
      ? input.allowlistedViews.map((item) => item.trim()).filter(Boolean)
      : [],
    allowlistedFieldTypes: Array.isArray(input.allowlistedFieldTypes)
      ? input.allowlistedFieldTypes.map((item) => item.trim()).filter(Boolean)
      : [],
  };
}
