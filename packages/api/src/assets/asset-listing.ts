import { getAssetTags } from '@ori/shared';
import { resolveAssetUsageSummary } from './asset-usage';
import type { Asset, AssetListOptions, AssetListResult } from './types';

export const UNASSIGNED_ASSET_TAG = '__untagged__';

export function mergeAssetFolders(folderResults: Asset[][]): Asset[] {
  const merged = new Map<string, Asset>();
  folderResults.flat().forEach((asset) => merged.set(asset.path, asset));
  return Array.from(merged.values());
}

export function attachAssetUsage(
  assets: Asset[],
  usageCounts: Map<string, number>
): Asset[] {
  return assets.map((asset) => ({
    ...asset,
    usage: resolveAssetUsageSummary(usageCounts.get(asset.path) || 0),
  }));
}

export function filterAssetsBySearch(assets: Asset[], search?: string): Asset[] {
  const normalizedSearch = search?.trim().toLowerCase() || '';
  if (!normalizedSearch) {
    return assets;
  }

  return assets.filter((asset) =>
    [
      asset.name,
      asset.path,
      String(asset.metadata?.altText || ''),
      String(asset.metadata?.caption || ''),
      ...getAssetTags(asset.metadata),
    ].some((value) => value.toLowerCase().includes(normalizedSearch))
  );
}

export function buildAssetTagFacets(assets: Asset[]): AssetListResult['facets']['tags'] {
  const tagCounts = assets.reduce((counts, asset) => {
    const assetTags = getAssetTags(asset.metadata);
    if (assetTags.length === 0) {
      counts.set(UNASSIGNED_ASSET_TAG, (counts.get(UNASSIGNED_ASSET_TAG) || 0) + 1);
      return counts;
    }

    assetTags.forEach((entry) => {
      counts.set(entry, (counts.get(entry) || 0) + 1);
    });
    return counts;
  }, new Map<string, number>());

  return Array.from(tagCounts.entries())
    .map(([value, count]) => ({
      value,
      label: value === UNASSIGNED_ASSET_TAG ? 'Untagged' : value,
      count,
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.label.localeCompare(right.label);
    });
}

export function filterAssetsByTag(assets: Asset[], tag?: string): Asset[] {
  if (!tag) {
    return assets;
  }

  return assets.filter((asset) => {
    const assetTags = getAssetTags(asset.metadata);
    if (tag === UNASSIGNED_ASSET_TAG) {
      return assetTags.length === 0;
    }
    return assetTags.includes(tag);
  });
}

export function buildAssetUsageFacets(
  assets: Asset[]
): AssetListResult['facets']['usage'] {
  return {
    used: assets.filter((asset) => asset.usage?.status === 'used').length,
    unused: assets.filter((asset) => asset.usage?.status !== 'used').length,
  };
}

export function filterAssetsByUsage(
  assets: Asset[],
  usage: AssetListOptions['usage'] = 'all'
): Asset[] {
  return assets.filter((asset) => {
    if (usage === 'used') {
      return asset.usage?.status === 'used';
    }
    if (usage === 'unused') {
      return asset.usage?.status === 'unused';
    }
    return true;
  });
}

export function sortAssets(
  assets: Asset[],
  sort: NonNullable<AssetListOptions['sort']>
): Asset[] {
  return [...assets].sort((left, right) => {
    if (sort === 'oldest') {
      return new Date(left.lastModified).getTime() - new Date(right.lastModified).getTime();
    }
    if (sort === 'name') {
      return left.name.localeCompare(right.name);
    }
    if (sort === 'size') {
      return right.size - left.size;
    }
    return new Date(right.lastModified).getTime() - new Date(left.lastModified).getTime();
  });
}

export function paginateAssets(
  assets: Asset[],
  limit: number | null,
  offset: number
): Pick<AssetListResult, 'assets' | 'pagination'> {
  const paginatedAssets = limit == null ? assets : assets.slice(offset, offset + limit);
  return {
    assets: paginatedAssets,
    pagination: {
      total: assets.length,
      limit,
      offset,
      hasMore: limit == null ? false : offset + paginatedAssets.length < assets.length,
    },
  };
}
