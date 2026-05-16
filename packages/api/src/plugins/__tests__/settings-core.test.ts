import { describe, expect, it } from 'vitest';
import {
  mergePluginHooksConfig,
  mergePluginUiPolicy,
  normalizeExecutionPolicy,
  parseEnabledPlugins,
  parsePluginExecutionPolicy,
  parsePluginHooksConfig,
  parsePluginSecretMetadata,
} from '../settings-core';

describe('plugin settings core', () => {
  it('parses enabled plugins and trims invalid entries', () => {
    expect(
      parseEnabledPlugins({
        plugins: { enabled: [' seo-tools ', '', 123, 'forms'] },
      })
    ).toEqual(['seo-tools', 'forms']);
  });

  it('parses hook config and clamps retry bounds', () => {
    expect(
      parsePluginHooksConfig({
        plugins: {
          hookEndpoints: {
            seo: { 'entry.publish': ' https://example.com/hook ' },
            empty: {},
          },
          retry: { maxAttempts: 99, baseDelayMs: 0, timeoutMs: 999999 },
        },
      })
    ).toEqual({
      hookEndpoints: {
        seo: { 'entry.publish': 'https://example.com/hook' },
      },
      retry: {
        maxAttempts: 10,
        baseDelayMs: 1,
        timeoutMs: 60000,
      },
    });
  });

  it('normalizes execution policy input against a fallback', () => {
    const fallback = parsePluginExecutionPolicy(null);
    expect(
      normalizeExecutionPolicy(
        {
          mode: 'disabled',
          enforceManifestCapabilities: false,
          allowlistedHooks: [' publish ', ''],
          blockedPlugins: [' seo '],
        },
        fallback
      )
    ).toEqual({
      mode: 'disabled',
      enforceManifestCapabilities: false,
      allowlistedHooks: ['publish'],
      blockedPlugins: ['seo'],
    });
  });

  it('merges hook config and ui policy into nested plugin settings', () => {
    const hooksMerged = mergePluginHooksConfig(
      { existing: true, plugins: { enabled: ['seo'] } },
      { seo: { publish: 'https://example.com/hook' } },
      { maxAttempts: 2, baseDelayMs: 10, timeoutMs: 1000 }
    );
    const uiMerged = mergePluginUiPolicy(hooksMerged, {
      includeDisabledPlugins: true,
      allowlistedViews: ['seo-panel'],
      allowlistedFieldTypes: ['seo-score'],
    });

    expect(uiMerged).toEqual({
      existing: true,
      plugins: {
        enabled: ['seo'],
        hookEndpoints: { seo: { publish: 'https://example.com/hook' } },
        retry: { maxAttempts: 2, baseDelayMs: 10, timeoutMs: 1000 },
        uiPolicy: {
          includeDisabledPlugins: true,
          allowlistedViews: ['seo-panel'],
          allowlistedFieldTypes: ['seo-score'],
        },
      },
    });
  });

  it('parses and sorts secret metadata', () => {
    expect(
      parsePluginSecretMetadata({
        plugins: {
          secrets: {
            zeta: { secretPrefix: 'zeta_123', rotatedAt: '2026-03-28T00:00:00.000Z' },
            alpha: { secretPrefix: 'alpha_123', rotatedAt: '2026-03-27T00:00:00.000Z' },
          },
        },
      })
    ).toEqual([
      { pluginId: 'alpha', secretPrefix: 'alpha_123', rotatedAt: '2026-03-27T00:00:00.000Z' },
      { pluginId: 'zeta', secretPrefix: 'zeta_123', rotatedAt: '2026-03-28T00:00:00.000Z' },
    ]);
  });
});
