import type { AssetReference, GlobalAssetReference, ProjectAssetReference } from './types';

export function createProjectAssetReference(
  path: string,
  overrides: Partial<Pick<ProjectAssetReference, 'alt' | 'caption'>> = {},
): ProjectAssetReference {
  return {
    $ref: 'asset',
    scope: 'project',
    path,
    ...overrides,
  };
}

export function createGlobalAssetReference(
  assetId: string,
  overrides: Partial<Pick<GlobalAssetReference, 'alt' | 'caption'>> = {},
): GlobalAssetReference {
  return {
    $ref: 'asset',
    scope: 'global',
    assetId,
    ...overrides,
  };
}

export function isAssetReference(value: unknown): value is AssetReference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.$ref !== 'asset') return false;

  if (record.scope === 'project') {
    return typeof record.path === 'string' && record.path.trim().length > 0;
  }

  if (record.scope === 'global') {
    return typeof record.assetId === 'string' && record.assetId.trim().length > 0;
  }

  return false;
}

export function isProjectAssetReference(value: unknown): value is ProjectAssetReference {
  return isAssetReference(value) && value.scope === 'project';
}

export function isGlobalAssetReference(value: unknown): value is GlobalAssetReference {
  return isAssetReference(value) && value.scope === 'global';
}

export function normalizeAssetReference(value: unknown): AssetReference | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? createProjectAssetReference(trimmed) : null;
  }

  if (isAssetReference(value)) {
    return value;
  }

  return null;
}

export function getProjectAssetPath(value: unknown): string | null {
  const reference = normalizeAssetReference(value);
  return reference?.scope === 'project' ? reference.path : null;
}

export function getAssetReferenceKey(value: unknown): string | null {
  const reference = normalizeAssetReference(value);
  if (!reference) return null;
  return reference.scope === 'project' ? `project:${reference.path}` : `global:${reference.assetId}`;
}

export function getAssetReferenceIdentifier(value: unknown): string {
  const reference = normalizeAssetReference(value);
  if (!reference) return '';
  return reference.scope === 'project' ? reference.path : reference.assetId;
}
