import type { PluginManifest } from '@ori/shared';

export interface PluginManifestValidationError {
  sourcePath: string;
  code:
    | 'PLUGIN_MANIFEST_PARSE_ERROR'
    | 'PLUGIN_MANIFEST_INVALID_SCHEMA'
    | 'PLUGIN_MANIFEST_DUPLICATE_ID';
  message: string;
}

export interface PluginRegistryListResult {
  manifests: PluginManifest[];
  invalidManifests: PluginManifestValidationError[];
}

export type ParsedManifestResult =
  | { manifest: PluginManifest }
  | { error: PluginManifestValidationError };
