import { useEffect, useMemo, useState } from 'react';
import type { AssetMetadata } from '@ori/shared';
import {
  buildAssetTagFacets,
  buildAssetTagOptions,
  matchesAssetBrowseFilters,
  sortAssetsByMode,
  type MediaSort,
  type MediaTypeFilter,
  type MediaViewMode,
} from '../lib/assets/browse';

interface BrowseableAsset {
  name: string;
  path: string;
  type: string;
  size: number;
  lastModified: string;
  metadata?: AssetMetadata;
}

interface UseAssetBrowseStateOptions<TAsset extends BrowseableAsset> {
  assets: TAsset[];
  getAssetId: (asset: TAsset) => string;
}

export function useAssetBrowseState<TAsset extends BrowseableAsset>({
  assets,
  getAssetId,
}: UseAssetBrowseStateOptions<TAsset>) {
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('all');
  const [selectedType, setSelectedType] = useState<MediaTypeFilter>('all');
  const [selectedSort, setSelectedSort] = useState<MediaSort>('newest');
  const [viewMode, setViewMode] = useState<MediaViewMode>('list');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const filteredAssets = useMemo(
    () => sortAssetsByMode(
      assets.filter((asset) => matchesAssetBrowseFilters(asset, { selectedType, selectedTag, search })),
      selectedSort,
    ),
    [assets, search, selectedSort, selectedTag, selectedType],
  );

  const tagOptions = useMemo(() => buildAssetTagOptions(assets), [assets]);
  const tagFacets = useMemo(() => buildAssetTagFacets(assets), [assets]);

  useEffect(() => {
    if (!filteredAssets.length) {
      setSelectedAssetId(null);
      return;
    }

    if (!selectedAssetId || !filteredAssets.some((asset) => getAssetId(asset) === selectedAssetId)) {
      setSelectedAssetId(getAssetId(filteredAssets[0]));
    }
  }, [filteredAssets, getAssetId, selectedAssetId]);

  return {
    search,
    setSearch,
    selectedTag,
    setSelectedTag,
    selectedType,
    setSelectedType,
    selectedSort,
    setSelectedSort,
    viewMode,
    setViewMode,
    selectedAssetId,
    setSelectedAssetId,
    filteredAssets,
    tagOptions,
    tagFacets,
  };
}
