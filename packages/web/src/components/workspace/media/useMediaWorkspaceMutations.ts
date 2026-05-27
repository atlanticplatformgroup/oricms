import type { Dispatch, SetStateAction } from 'react';
import { useMutation, type QueryClient } from '@tanstack/react-query';
import { getAssetTags, type AssetMetadata } from '@ori/shared';
import { assetsApi, globalAssetsApi } from '../../../lib/api/assets';
import type { UploadAssetScope } from './UploadAssetModal';

type ShowToast = (
  message: string,
  type?: 'success' | 'error' | 'warning' | 'info',
  options?: { duration?: number },
) => void;

export function useMediaWorkspaceMutations(params: {
  projectId: string;
  queryClient: QueryClient;
  assets: Array<{ path: string; metadata?: AssetMetadata }>;
  selectedAssetPath: string | null;
  setSelectedAsset: (path: string | null) => void;
  setSelectedAssetPaths: Dispatch<SetStateAction<string[]>>;
  setSelectionMode: Dispatch<SetStateAction<boolean>>;
  setBulkTagDraft: Dispatch<SetStateAction<string>>;
  showToast: ShowToast;
}) {
  const {
    projectId,
    queryClient,
    assets,
    selectedAssetPath,
    setSelectedAsset,
    setSelectedAssetPaths,
    setSelectionMode,
    setBulkTagDraft,
    showToast,
  } = params;

  const updateMetadataMutation = useMutation({
    mutationFn: ({ path, metadata }: { path: string; metadata: AssetMetadata }) =>
      assetsApi.updateMetadata(projectId, path, metadata),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['media-workspace-assets', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['media-workspace-asset', projectId] }),
      ]);
      showToast('Asset metadata saved', 'success');
    },
    onError: () => {
      showToast('Failed to save asset metadata', 'error');
    },
  });

  const uploadAssetMutation = useMutation({
    mutationFn: async ({
      filename,
      content,
      libraryFolder,
      tags,
      scope,
    }: {
      filename: string;
      content: string;
      libraryFolder: 'images' | 'documents';
      tags: string[];
      scope: UploadAssetScope;
    }) => {
      if (scope === 'global') {
        const { asset } = await globalAssetsApi.upload(projectId, filename, content, libraryFolder, tags);
        return { asset, scope };
      }

      const { asset } = await assetsApi.upload(
        projectId,
        filename,
        content,
        libraryFolder,
        tags.length > 0 ? { tags } : undefined,
      );
      return { asset, scope };
    },
    onSuccess: async ({ asset, scope }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['media-workspace-assets', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['media-workspace-asset', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['global-assets', projectId] }),
      ]);

      if (scope === 'project') {
        setSelectedAsset(asset.path);
        showToast('Asset uploaded to project library', 'success');
        return;
      }

      showToast('Asset uploaded to global library', 'success');
    },
    onError: () => {
      showToast('Failed to upload asset', 'error');
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (path: string) => assetsApi.delete(projectId, path),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['media-workspace-assets', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['media-workspace-asset', projectId] }),
      ]);
      setSelectedAsset(null);
      showToast('Asset deleted', 'success');
    },
    onError: () => {
      showToast('Failed to delete asset', 'error');
    },
  });

  const bulkTagMutation = useMutation({
    mutationFn: async ({ paths, tag }: { paths: string[]; tag: string }) => {
      await Promise.all(
        paths.map(async (path) => {
          const asset = assets.find((entry) => entry.path === path);
          const metadata = { ...(asset?.metadata ?? {}) } as AssetMetadata;
          const currentTags = getAssetTags(metadata);
          if (tag) {
            metadata.tags = Array.from(new Set([...currentTags, tag]));
          } else {
            delete metadata.tags;
          }
          return assetsApi.updateMetadata(projectId, path, metadata);
        }),
      );
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['media-workspace-assets', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['media-workspace-asset', projectId] }),
      ]);
      setSelectedAssetPaths([]);
      setSelectionMode(false);
      setBulkTagDraft('');
      showToast('Asset tags updated', 'success');
    },
    onError: () => {
      showToast('Failed to update selected assets', 'error');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (paths: string[]) => {
      await Promise.all(paths.map((path) => assetsApi.delete(projectId, path)));
    },
    onSuccess: async (_result, deletedPaths) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['media-workspace-assets', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['media-workspace-asset', projectId] }),
      ]);
      if (selectedAssetPath && deletedPaths.includes(selectedAssetPath)) {
        setSelectedAsset(null);
      }
      setSelectedAssetPaths([]);
      setSelectionMode(false);
      setBulkTagDraft('');
      showToast('Selected assets deleted', 'success');
    },
    onError: () => {
      showToast('Failed to delete selected assets', 'error');
    },
  });

  return {
    bulkDeleteMutation,
    bulkTagMutation,
    deleteAssetMutation,
    updateMetadataMutation,
    uploadAssetMutation,
  };
}
