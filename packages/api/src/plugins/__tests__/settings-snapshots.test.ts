import { describe, expect, it } from 'vitest';
import {
  buildPluginHealthSnapshot,
  buildPluginUiContributionsSnapshot,
} from '../settings-snapshots';

describe('plugin settings snapshots', () => {
  it('reports stale and missing hook configuration', () => {
    const manifests = [
      {
        id: 'seo',
        name: 'SEO',
        version: '1.0.0',
        hooks: ['entry.publish', 'entry.unpublish'],
        capabilities: { webhooks: true },
        sourcePath: 'plugins/seo.yaml',
      },
    ];

    expect(
      buildPluginHealthSnapshot({
        manifests,
        settings: {
          plugins: {
            enabled: ['seo', 'missing-plugin'],
            hookEndpoints: {
              seo: { 'entry.publish': 'https://example.com/publish', unknown: 'https://example.com/other' },
              orphan: { dangling: 'https://example.com/dangling' },
            },
            executionPolicy: {
              blockedPlugins: ['seo'],
            },
          },
        },
      })
    ).toEqual({
      staleEnabledPlugins: ['missing-plugin'],
      blockedEnabledPlugins: ['seo'],
      missingHookEndpoints: [{ pluginId: 'seo', hooks: ['entry.unpublish'] }],
      staleHookEndpoints: [
        { pluginId: 'seo', hooks: ['unknown'] },
        { pluginId: 'orphan', hooks: ['dangling'] },
      ],
    });
  });

  it('builds UI contribution snapshots with policy filtering and rejected totals', () => {
    const manifests = [
      {
        id: 'seo',
        name: 'SEO',
        version: '1.0.0',
        capabilities: { views: true, fieldTypes: false },
        ui: { views: ['seo-panel', 'seo-alerts'], fieldTypes: ['seo-score'] },
        sourcePath: 'plugins/seo.yaml',
      },
      {
        id: 'forms',
        name: 'Forms',
        version: '1.0.0',
        capabilities: { views: true, fieldTypes: true },
        ui: { views: ['forms-panel'], fieldTypes: ['forms-score'] },
        sourcePath: 'plugins/forms.yaml',
      },
    ];

    expect(
      buildPluginUiContributionsSnapshot({
        manifests,
        settings: {
          plugins: {
            enabled: ['seo'],
            uiPolicy: {
              allowlistedViews: ['seo-panel'],
              allowlistedFieldTypes: ['forms-score'],
            },
          },
        },
        uiPolicyOverride: {
          includeDisabledPlugins: true,
          allowlistedViews: ['seo-panel'],
          allowlistedFieldTypes: ['forms-score'],
        },
      })
    ).toEqual({
      contributions: [
        {
          pluginId: 'seo',
          pluginName: 'SEO',
          enabled: true,
          views: ['seo-panel'],
          fieldTypes: [],
          rejected: {
            views: ['seo-alerts'],
            fieldTypes: ['seo-score'],
          },
        },
        {
          pluginId: 'forms',
          pluginName: 'Forms',
          enabled: false,
          views: [],
          fieldTypes: ['forms-score'],
          rejected: {
            views: ['forms-panel'],
            fieldTypes: [],
          },
        },
      ],
      totals: {
        views: 1,
        fieldTypes: 1,
        rejectedViews: 2,
        rejectedFieldTypes: 1,
      },
    });
  });
});
