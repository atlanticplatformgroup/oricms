import { API_BASE_URL } from '../api/core';
import { getAssetTags, type Asset } from '@ori/shared';
import type { GlobalAsset } from './references';

export type DisplayAsset = Asset | GlobalAsset;

export function getAssetOptionLabel(asset: Asset): string {
  return `${asset.name} · ${asset.path}`;
}

export function getAssetTypeLabel(type: Asset['type']): string {
  if (type === 'image') return 'Image';
  if (type === 'document') return 'Document';
  return 'File';
}

export function formatAssetSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatAssetUsage(asset: Pick<Asset, 'usage'>): { label: string; color: 'teal' | 'gray' } {
  const usage = asset.usage;
  if (!usage || usage.status === 'unused' || usage.count === 0) {
    return { label: 'Unused', color: 'gray' };
  }

  return {
    label: usage.count === 1 ? 'Used in 1 entry' : `Used in ${usage.count} entries`,
    color: 'teal',
  };
}

export function getAssetDisplayTags(asset: Pick<Asset, 'metadata'>): string[] {
  return getAssetTags(asset.metadata);
}

export function isGlobalAsset(asset: DisplayAsset): asset is GlobalAsset {
  return 'scope' in asset && asset.scope === 'global' && 'assetId' in asset;
}

export function getAssetIdentifier(asset: DisplayAsset): string {
  return isGlobalAsset(asset) ? asset.assetId : asset.path;
}

export function getAssetRenderUrl(url: string): string {
  if (!url) return url;

  const base = API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  const resolved = /^https?:\/\//i.test(url) ? new URL(url) : new URL(url, base);

  if (resolved.pathname.startsWith('/api/v1/projects/')) {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('accessToken') : null;
    if (token && !resolved.searchParams.has('token')) {
      resolved.searchParams.set('token', token);
    }
  }

  return resolved.toString();
}
