import type { AssetMetadata } from './types';

function normalizeTagValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry).trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

export function getAssetTags(metadata?: AssetMetadata | null): string[] {
  if (!metadata) return [];

  const tags = normalizeTagValue(metadata.tags);
  if (tags.length > 0) {
    return Array.from(new Set(tags));
  }

  if (typeof metadata.folder === 'string' && metadata.folder.trim()) {
    return [metadata.folder.trim()];
  }

  return [];
}

export function getPrimaryAssetTag(metadata?: AssetMetadata | null): string | null {
  return getAssetTags(metadata)[0] || null;
}

export function normalizeAssetMetadata(metadata?: AssetMetadata | null): AssetMetadata {
  const next: AssetMetadata = { ...(metadata || {}) };
  const tags = getAssetTags(next);

  if (tags.length > 0) {
    next.tags = tags;
  } else {
    delete next.tags;
  }

  delete next.folder;

  return next;
}
