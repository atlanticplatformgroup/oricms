import { describe, expect, it } from 'vitest';
import {
  addParsedManifest,
  buildDuplicateManifestError,
  createPluginRegistryResult,
  parseManifest,
  sortPluginRegistryResult,
} from '../manifest-support';

describe('plugin manifest support', () => {
  it('parses a valid manifest with optional capabilities and ui fields', () => {
    const parsed = parseManifest(
      [
        'id: seo-tools',
        'name: SEO Tools',
        'version: 1.2.3',
        'capabilities:',
        '  views: true',
        '  fieldTypes: true',
        'ui:',
        '  views: [seo-panel]',
        'hooks: [collection.record.created]',
      ].join('\n'),
      'plugins/seo-tools.yaml'
    );

    expect(parsed).toEqual({
      manifest: {
        id: 'seo-tools',
        name: 'SEO Tools',
        version: '1.2.3',
        capabilities: { views: true, fieldTypes: true },
        ui: { views: ['seo-panel'] },
        hooks: ['collection.record.created'],
        sourcePath: 'plugins/seo-tools.yaml',
      },
    });
  });

  it('reports invalid schema details for missing required fields', () => {
    expect(parseManifest('name: Missing Id', 'plugins/bad.yaml')).toEqual({
      error: {
        sourcePath: 'plugins/bad.yaml',
        code: 'PLUGIN_MANIFEST_INVALID_SCHEMA',
        message: 'Manifest requires non-empty id, name, and version fields',
      },
    });
  });

  it('tracks duplicates and sorts final registry output', () => {
    const result = createPluginRegistryResult();
    const seenIds = new Set<string>();

    addParsedManifest(
      { ...result, seenIds },
      'plugins/b.yaml',
      parseManifest('id: b-plugin\nname: B\nversion: 1.0.0', 'plugins/b.yaml')
    );
    addParsedManifest(
      { ...result, seenIds },
      'plugins/a.yaml',
      parseManifest('id: a-plugin\nname: A\nversion: 1.0.0', 'plugins/a.yaml')
    );
    addParsedManifest(
      { ...result, seenIds },
      'plugins/dup.yaml',
      parseManifest('id: a-plugin\nname: Duplicate\nversion: 1.0.0', 'plugins/dup.yaml')
    );

    expect(sortPluginRegistryResult(result)).toEqual({
      manifests: [
        { id: 'a-plugin', name: 'A', version: '1.0.0', sourcePath: 'plugins/a.yaml' },
        { id: 'b-plugin', name: 'B', version: '1.0.0', sourcePath: 'plugins/b.yaml' },
      ],
      invalidManifests: [buildDuplicateManifestError('plugins/dup.yaml', 'a-plugin')],
    });
  });
});
