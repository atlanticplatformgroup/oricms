import type { PluginManifest } from '@ori/shared';
import {
  parseEnabledPlugins,
  parsePluginExecutionPolicy,
  parsePluginHooksConfig,
  parsePluginUiPolicy,
} from './settings-core';

export interface PluginHealthSnapshot {
  staleEnabledPlugins: string[];
  blockedEnabledPlugins: string[];
  missingHookEndpoints: Array<{ pluginId: string; hooks: string[] }>;
  staleHookEndpoints: Array<{ pluginId: string; hooks: string[] }>;
}

export interface PluginUiContributionsSnapshot {
  contributions: Array<{
    pluginId: string;
    pluginName: string;
    enabled: boolean;
    views: string[];
    fieldTypes: string[];
    rejected: {
      views: string[];
      fieldTypes: string[];
    };
  }>;
  totals: {
    views: number;
    fieldTypes: number;
    rejectedViews: number;
    rejectedFieldTypes: number;
  };
}

export function buildPluginHealthSnapshot(input: {
  manifests: PluginManifest[];
  settings: unknown;
}): PluginHealthSnapshot {
  const manifestMap = new Map(input.manifests.map((manifest) => [manifest.id, manifest]));
  const enabled = parseEnabledPlugins(input.settings);
  const hookConfig = parsePluginHooksConfig(input.settings);
  const executionPolicy = parsePluginExecutionPolicy(input.settings);

  const staleEnabledPlugins = enabled.filter((pluginId) => !manifestMap.has(pluginId));
  const blockedEnabledPlugins = enabled.filter((pluginId) =>
    executionPolicy.blockedPlugins.includes(pluginId)
  );
  const missingHookEndpoints: Array<{ pluginId: string; hooks: string[] }> = [];
  const staleHookEndpoints: Array<{ pluginId: string; hooks: string[] }> = [];

  for (const pluginId of enabled) {
    const manifest = manifestMap.get(pluginId);
    if (!manifest) {
      continue;
    }
    if (executionPolicy.enforceManifestCapabilities && manifest.capabilities?.webhooks !== true) {
      continue;
    }
    const declaredHooks = manifest.hooks || [];
    if (declaredHooks.length === 0) {
      continue;
    }
    const configuredEvents = hookConfig.hookEndpoints[pluginId] || {};
    const missing = declaredHooks.filter((event) => !configuredEvents[event]);
    if (missing.length > 0) {
      missingHookEndpoints.push({ pluginId, hooks: missing });
    }
  }

  for (const [pluginId, hooks] of Object.entries(hookConfig.hookEndpoints)) {
    const manifest = manifestMap.get(pluginId);
    if (!manifest) {
      staleHookEndpoints.push({ pluginId, hooks: Object.keys(hooks) });
      continue;
    }
    const declaredHooks = new Set(manifest.hooks || []);
    const staleHooks = Object.keys(hooks).filter((event) => !declaredHooks.has(event));
    if (staleHooks.length > 0) {
      staleHookEndpoints.push({ pluginId, hooks: staleHooks });
    }
  }

  return { staleEnabledPlugins, blockedEnabledPlugins, missingHookEndpoints, staleHookEndpoints };
}

export function buildPluginUiContributionsSnapshot(input: {
  manifests: PluginManifest[];
  settings: unknown;
  uiPolicyOverride?: {
    includeDisabledPlugins: boolean;
    allowlistedViews: string[];
    allowlistedFieldTypes: string[];
  };
}): PluginUiContributionsSnapshot {
  const enabledSet = new Set(parseEnabledPlugins(input.settings));
  const uiPolicy = input.uiPolicyOverride || parsePluginUiPolicy(input.settings);
  const contributions = input.manifests
    .map((manifest) => {
      const uiViews = manifest.ui?.views || [];
      const uiFieldTypes = manifest.ui?.fieldTypes || [];
      const capabilityAllowedViews = manifest.capabilities?.views === true ? uiViews : [];
      const capabilityAllowedFieldTypes =
        manifest.capabilities?.fieldTypes === true ? uiFieldTypes : [];
      const capabilityRejectedViews = manifest.capabilities?.views === true ? [] : uiViews;
      const capabilityRejectedFieldTypes =
        manifest.capabilities?.fieldTypes === true ? [] : uiFieldTypes;

      const policyAllowedViews =
        uiPolicy.allowlistedViews.length > 0
          ? capabilityAllowedViews.filter((item) => uiPolicy.allowlistedViews.includes(item))
          : capabilityAllowedViews;
      const policyAllowedFieldTypes =
        uiPolicy.allowlistedFieldTypes.length > 0
          ? capabilityAllowedFieldTypes.filter((item) =>
              uiPolicy.allowlistedFieldTypes.includes(item)
            )
          : capabilityAllowedFieldTypes;
      const policyRejectedViews = capabilityAllowedViews.filter(
        (item) => !policyAllowedViews.includes(item)
      );
      const policyRejectedFieldTypes = capabilityAllowedFieldTypes.filter(
        (item) => !policyAllowedFieldTypes.includes(item)
      );
      return {
        pluginId: manifest.id,
        pluginName: manifest.name,
        enabled: enabledSet.has(manifest.id),
        views: policyAllowedViews,
        fieldTypes: policyAllowedFieldTypes,
        rejected: {
          views: [...capabilityRejectedViews, ...policyRejectedViews],
          fieldTypes: [...capabilityRejectedFieldTypes, ...policyRejectedFieldTypes],
        },
      };
    })
    .filter((item) => uiPolicy.includeDisabledPlugins || item.enabled);

  return {
    contributions,
    totals: {
      views: contributions.reduce((total, row) => total + row.views.length, 0),
      fieldTypes: contributions.reduce((total, row) => total + row.fieldTypes.length, 0),
      rejectedViews: contributions.reduce((total, row) => total + row.rejected.views.length, 0),
      rejectedFieldTypes: contributions.reduce(
        (total, row) => total + row.rejected.fieldTypes.length,
        0
      ),
    },
  };
}
