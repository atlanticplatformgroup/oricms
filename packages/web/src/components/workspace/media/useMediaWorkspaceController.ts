import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssetMetadata } from '@ori/shared';
import { assetsApi } from '../../../lib/api/assets';
import { useMediaBrowseQueryState } from '../../../hooks/useMediaBrowseQueryState';
import {
  buildTagOptions,
  filterSelectedAssetPaths,
  getMetadataDraftFromAsset,
  getSelectedAsset,
  hasUnsavedMetadata,
  MEDIA_PAGE_SIZE,
  resetMediaSelectionState,
} from './media-controller-support';
import { useMediaWorkspaceMutations } from './useMediaWorkspaceMutations';

type ShowToast = (
  message: string,
  type?: 'success' | 'error' | 'warning' | 'info',
  options?: { duration?: number },
) => void;

export function useMediaWorkspaceController({
  projectId,
  selectedView,
  showToast,
}: {
  projectId: string;
  selectedView: string;
  showToast: ShowToast;
}) {
  const queryClient = useQueryClient();
  const [metadataDraft, setMetadataDraft] = useState({ altText: '', caption: '', tags: [] as string[] });
  const [uploadOpened, setUploadOpened] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedAssetPaths, setSelectedAssetPaths] = useState<string[]>([]);
  const [bulkTagDraft, setBulkTagDraft] = useState('');
  const {
    searchValue,
    setSearchValue,
    activeSearch,
    selectedType,
    selectedTag,
    selectedUsage,
    selectedSort,
    selectedViewMode,
    selectedAssetPath,
    libraryFolder,
    setType,
    setTag,
    setUsage,
    setSort,
    setViewMode,
    setSelectedAsset,
    clearFilters,
  } = useMediaBrowseQueryState({ selectedView });

  const mediaQuery = useInfiniteQuery({
    queryKey: ['media-workspace-assets', projectId, libraryFolder, selectedTag, selectedUsage, activeSearch, selectedSort],
    queryFn: ({ pageParam = 0 }) =>
      assetsApi.list(projectId, {
        folder: libraryFolder,
        tag: selectedTag === 'all' ? undefined : selectedTag,
        usage: selectedUsage,
        search: activeSearch.trim() || undefined,
        sort: selectedSort,
        limit: MEDIA_PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (
      lastPage.pagination.hasMore
        ? lastPage.pagination.offset + lastPage.assets.length
        : undefined
    ),
    enabled: Boolean(projectId),
  });

  const assets = useMemo(
    () => mediaQuery.data?.pages.flatMap((page) => page.assets) ?? [],
    [mediaQuery.data],
  );

  const selectedAssetQuery = useQuery({
    queryKey: ['media-workspace-asset', projectId, selectedAssetPath],
    queryFn: () => assetsApi.get(projectId, selectedAssetPath!),
    enabled: Boolean(projectId && selectedAssetPath),
  });

  const {
    bulkDeleteMutation,
    bulkTagMutation,
    deleteAssetMutation,
    updateMetadataMutation,
    uploadAssetMutation,
  } = useMediaWorkspaceMutations({
    projectId,
    queryClient,
    assets: assets as Array<{ path: string; metadata?: AssetMetadata }>,
    selectedAssetPath,
    setSelectedAsset,
    setSelectedAssetPaths,
    setSelectionMode,
    setBulkTagDraft,
    showToast,
  });

  const tagOptions = useMemo(() => {
    const tags = mediaQuery.data?.pages[0]?.facets.tags ?? [];
    return buildTagOptions(tags);
  }, [mediaQuery.data]);

  const tagFacets = mediaQuery.data?.pages[0]?.facets.tags ?? [];
  const usageFacets = mediaQuery.data?.pages[0]?.facets.usage ?? { used: 0, unused: 0 };
  const totalAssets = mediaQuery.data?.pages[0]?.pagination.total ?? 0;

  useEffect(() => {
    setSelectedAssetPaths((current) => filterSelectedAssetPaths(current, assets));
  }, [assets]);

  useEffect(() => {
    const resetState = resetMediaSelectionState();
    setSelectionMode(resetState.selectionMode);
    setSelectedAssetPaths(resetState.selectedAssetPaths);
    setBulkTagDraft(resetState.bulkTagDraft);
  }, [selectedType, selectedTag, selectedUsage, activeSearch]);

  const selectedAsset = useMemo(() => getSelectedAsset({
    assets,
    selectedAssetPath,
    selectedAssetFromQuery: selectedAssetQuery.data?.asset,
  }), [assets, selectedAssetPath, selectedAssetQuery.data?.asset]);

  useEffect(() => {
    if (!selectedAssetPath && assets[0]) {
      setSelectedAsset(assets[0].path);
    } else if (
      selectedAssetPath &&
      !assets.some((asset) => asset.path === selectedAssetPath) &&
      !selectedAssetQuery.isFetching &&
      selectedAssetQuery.isError
    ) {
      setSelectedAsset(assets[0]?.path ?? null);
    }
  }, [assets, selectedAssetPath, selectedAssetQuery.isError, selectedAssetQuery.isFetching, setSelectedAsset]);

  useEffect(() => {
    setMetadataDraft(getMetadataDraftFromAsset(selectedAsset));
  }, [selectedAsset]);

  const metadataIsDirty = hasUnsavedMetadata({ selectedAsset, metadataDraft });

  return {
    assets,
    activeSearch,
    bulkDeleteMutation,
    bulkTagDraft,
    bulkTagMutation,
    clearFilters,
    deleteAssetMutation,
    hasUnsavedMetadata: metadataIsDirty,
    isError: mediaQuery.isError,
    isLoading: mediaQuery.isLoading,
    mediaQuery,
    metadataDraft,
    searchValue,
    selectedAsset,
    selectedAssetPath,
    selectedAssetPaths,
    selectedAssetQuery,
    selectedLibraryBucket: (selectedType === 'documents' ? 'documents' : 'images') as 'images' | 'documents',
    selectedSort,
    selectedTag,
    selectedType,
    selectedUsage,
    selectedViewMode,
    selectionMode,
    setBulkTagDraft,
    setMetadataDraft,
    setSearchValue,
    setSelectedAsset,
    setSelectedAssetPaths,
    setSelectionMode,
    setSort,
    setTag,
    setType,
    setUsage,
    setViewMode,
    tagFacets,
    tagOptions,
    totalAssets,
    updateMetadataMutation,
    uploadAssetMutation,
    uploadOpened,
    setUploadOpened,
    usageFacets,
  };
}
