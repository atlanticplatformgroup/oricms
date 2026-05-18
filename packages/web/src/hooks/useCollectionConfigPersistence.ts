import { useMutation, type QueryClient } from '@tanstack/react-query';
import type { CollectionConfig } from '@ori/shared';
import { collectionsApi } from '../lib/api/collections';
import { collectionQueryKeys } from './queries/useCollectionQueries';
import { buildWorkspacePath } from '../lib/workspace/routing';
import type { SectionKey } from '../lib/workspace/types';

interface UseCollectionConfigPersistenceOptions {
  projectId: string | null;
  activeProjectSlug: string | null;
  activeBranchName: string | null;
  activeSection: SectionKey;
  showToast: (message: string, tone?: 'success' | 'error' | 'info') => void;
  queryClient: QueryClient;
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

export function useCollectionConfigPersistence({
  projectId,
  activeProjectSlug,
  activeBranchName,
  activeSection,
  showToast,
  queryClient,
  navigate,
}: UseCollectionConfigPersistenceOptions) {
  const updateCollectionsConfigMutation = useMutation({
    mutationFn: async ({
      nextCollections,
      nextCollectionId,
      action,
      headers,
    }: {
      nextCollections: CollectionConfig[];
      nextCollectionId?: string | null;
      action: 'save' | 'delete';
      headers?: Record<string, string>;
    }) => {
      await collectionsApi.updateConfig(projectId!, nextCollections, headers);
      return { nextCollectionId: nextCollectionId ?? null, action };
    },
    onSuccess: ({ nextCollectionId, action }) => {
      showToast(action === 'delete' ? 'Schema deleted' : 'Schema settings saved', 'success');
      void queryClient.invalidateQueries({ queryKey: collectionQueryKeys.lists(projectId!) });
      if (activeProjectSlug && activeSection === 'collections') {
        navigate(buildWorkspacePath(activeProjectSlug, 'collections', nextCollectionId, { branchName: activeBranchName }), { replace: true });
      }
    },
    onError: () => {
      showToast('Failed to update schema settings', 'error');
    },
  });

  const deleteCollectionMutation = useMutation({
    mutationFn: async ({
      collectionId,
      nextCollectionId,
      headers,
    }: {
      collectionId: string;
      nextCollectionId?: string | null;
      headers?: Record<string, string>;
    }) => {
      await collectionsApi.deleteCollection(projectId!, collectionId, headers);
      return { nextCollectionId: nextCollectionId ?? null };
    },
    onSuccess: ({ nextCollectionId }) => {
      showToast('Schema deleted', 'success');
      void queryClient.invalidateQueries({ queryKey: collectionQueryKeys.lists(projectId!) });
      if (activeProjectSlug && activeSection === 'collections') {
        navigate(buildWorkspacePath(activeProjectSlug, 'collections', nextCollectionId, { branchName: activeBranchName }), { replace: true });
      }
    },
    onError: () => {
      showToast('Failed to delete collection', 'error');
    },
  });

  return {
    updateCollectionsConfigMutation,
    deleteCollectionMutation,
  };
}
