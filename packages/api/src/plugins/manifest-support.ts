import YAML from 'yaml';
import type {
  ParsedManifestResult,
  PluginManifestValidationError,
  PluginRegistryListResult,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function isSemver(value: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value);
}

function isPluginId(value: string): boolean {
  return /^[a-z0-9][a-z0-9-_]*$/.test(value);
}

export function parseManifest(raw: string, sourcePath: string): ParsedManifestResult {
  let parsed: unknown;
  try {
    parsed = YAML.parse(raw);
  } catch {
    return {
      error: {
        sourcePath,
        code: 'PLUGIN_MANIFEST_PARSE_ERROR',
        message: 'Manifest is not valid YAML',
      },
    };
  }

  if (!isRecord(parsed)) {
    return {
      error: {
        sourcePath,
        code: 'PLUGIN_MANIFEST_INVALID_SCHEMA',
        message: 'Manifest must be a YAML object',
      },
    };
  }

  const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';
  const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
  const version = typeof parsed.version === 'string' ? parsed.version.trim() : '';

  if (!id || !name || !version) {
    return {
      error: {
        sourcePath,
        code: 'PLUGIN_MANIFEST_INVALID_SCHEMA',
        message: 'Manifest requires non-empty id, name, and version fields',
      },
    };
  }

  if (!isPluginId(id)) {
    return {
      error: {
        sourcePath,
        code: 'PLUGIN_MANIFEST_INVALID_SCHEMA',
        message: `Manifest id "${id}" is invalid. Use lowercase letters, numbers, dashes, or underscores.`,
      },
    };
  }

  if (!isSemver(version)) {
    return {
      error: {
        sourcePath,
        code: 'PLUGIN_MANIFEST_INVALID_SCHEMA',
        message: `Manifest version "${version}" must be semver (e.g. 1.2.3)`,
      },
    };
  }

  const capabilities = isRecord(parsed.capabilities)
    ? {
        ...(parsed.capabilities.fieldTypes === true ? { fieldTypes: true } : {}),
        ...(parsed.capabilities.views === true ? { views: true } : {}),
        ...(parsed.capabilities.webhooks === true ? { webhooks: true } : {}),
        ...(parsed.capabilities.validators === true ? { validators: true } : {}),
        ...(parsed.capabilities.automations === true ? { automations: true } : {}),
      }
    : undefined;

  const ui = isRecord(parsed.ui)
    ? {
        ...(toStringArray(parsed.ui.fieldTypes)
          ? { fieldTypes: toStringArray(parsed.ui.fieldTypes) }
          : {}),
        ...(toStringArray(parsed.ui.views) ? { views: toStringArray(parsed.ui.views) } : {}),
      }
    : undefined;

  return {
    manifest: {
      id,
      name,
      version,
      ...(typeof parsed.description === 'string' ? { description: parsed.description } : {}),
      ...(typeof parsed.author === 'string' ? { author: parsed.author } : {}),
      ...(capabilities && Object.keys(capabilities).length > 0 ? { capabilities } : {}),
      ...(toStringArray(parsed.hooks) ? { hooks: toStringArray(parsed.hooks) } : {}),
      ...(ui && Object.keys(ui).length > 0 ? { ui } : {}),
      sourcePath,
    },
  };
}

export function buildDuplicateManifestError(
  sourcePath: string,
  id: string
): PluginManifestValidationError {
  return {
    sourcePath,
    code: 'PLUGIN_MANIFEST_DUPLICATE_ID',
    message: `Duplicate plugin id "${id}"`,
  };
}

export function sortPluginRegistryResult(
  input: PluginRegistryListResult
): PluginRegistryListResult {
  input.manifests.sort((a, b) => a.id.localeCompare(b.id));
  input.invalidManifests.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  return input;
}

export function createPluginRegistryResult(): PluginRegistryListResult {
  return {
    manifests: [],
    invalidManifests: [],
  };
}

export function addParsedManifest(
  input: PluginRegistryListResult & { seenIds: Set<string> },
  sourcePath: string,
  parsed: ParsedManifestResult
): void {
  if ('error' in parsed) {
    input.invalidManifests.push(parsed.error);
    return;
  }

  if (input.seenIds.has(parsed.manifest.id)) {
    input.invalidManifests.push(buildDuplicateManifestError(sourcePath, parsed.manifest.id));
    return;
  }

  input.seenIds.add(parsed.manifest.id);
  input.manifests.push(parsed.manifest);
}
