import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assetsApi } from '../../lib/api/assets';
import { useToast } from '../../contexts/ToastContext';
import type { AssetMetadata } from '@ori/shared';

export const assetQueryKeys = {
  all: ['assets'] as const,
  list: (projectId: string, folder: string) => [...assetQueryKeys.all, 'list', projectId, folder] as const,
};

export function useAssets(projectId?: string, folder: string = 'images') {
  return useQuery({
    queryKey: assetQueryKeys.list(projectId!, folder),
    queryFn: () => assetsApi.list(projectId!, folder),
    enabled: !!projectId,
  });
}

export function useUploadAsset(projectId?: string, folder: string = 'images') {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ filename, content }: { filename: string; content: string }) => 
      assetsApi.upload(projectId!, filename, content, folder),
    onSuccess: (data) => {
      showToast(`Uploaded ${data.asset.name}`, 'success');
      void queryClient.invalidateQueries({ queryKey: assetQueryKeys.list(projectId!, folder) });
    },
    onError: () => {
      showToast('Failed to upload asset', 'error');
    },
  });
}

export function useDeleteAsset(projectId?: string, folder: string = 'images') {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (path: string) => assetsApi.delete(projectId!, path),
    onSuccess: () => {
      showToast('Asset deleted', 'success');
      void queryClient.invalidateQueries({ queryKey: assetQueryKeys.list(projectId!, folder) });
    },
    onError: () => {
      showToast('Failed to delete asset', 'error');
    },
  });
}

export function useUpdateAssetMetadata(projectId?: string, folder: string = 'images') {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ path, metadata }: { path: string; metadata: AssetMetadata }) => 
      assetsApi.updateMetadata(projectId!, path, metadata),
    onSuccess: () => {
      showToast('Metadata updated', 'success');
      void queryClient.invalidateQueries({ queryKey: assetQueryKeys.list(projectId!, folder) });
    },
    onError: () => {
      showToast('Failed to update metadata', 'error');
    },
  });
}
