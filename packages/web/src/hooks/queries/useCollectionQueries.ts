import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collectionsApi, contentTypesApi } from '../../lib/api/collections';
import { useToast } from '../../contexts/ToastContext';
import type { CollectionEntry, CollectionConfig } from '@ori/shared';

export const collectionQueryKeys = {
  all: ['collections'] as const,
  lists: (projectId: string, branchKey?: string | null) => [...collectionQueryKeys.all, 'list', projectId, branchKey ?? null] as const,
  contentTypes: (projectId: string, branchKey?: string | null) => [...collectionQueryKeys.all, 'contentTypes', projectId, branchKey ?? null] as const,
  entries: (projectId: string, collectionId: string, options?: any, branchKey?: string | null) =>
    [...collectionQueryKeys.all, 'entries', projectId, collectionId, branchKey ?? null, options] as const,
  history: (projectId: string, collectionId: string, entryId: string, branch?: string) =>
    [...collectionQueryKeys.all, 'history', projectId, collectionId, entryId, branch] as const,
  version: (projectId: string, collectionId: string, entryId: string, hash: string, branch?: string) =>
    [...collectionQueryKeys.all, 'version', projectId, collectionId, entryId, hash, branch] as const,
};

export function useCollections(projectId?: string, branchKey?: string | null) {
  return useQuery({
    queryKey: collectionQueryKeys.lists(projectId!, branchKey),
    queryFn: () => collectionsApi.list(projectId!),
    enabled: !!projectId,
  });
}

export function useContentTypes(projectId?: string, branchKey?: string | null) {
  return useQuery({
    queryKey: collectionQueryKeys.contentTypes(projectId!, branchKey),
    queryFn: () => contentTypesApi.list(projectId!),
    enabled: !!projectId,
  });
}

export function useCollectionEntries(projectId?: string, collectionId?: string, options?: any, branchKey?: string | null) {
  return useQuery({
    queryKey: collectionQueryKeys.entries(projectId!, collectionId!, options, branchKey),
    queryFn: () => collectionsApi.listEntries(projectId!, collectionId!, options),
    enabled: !!projectId && !!collectionId,
  });
}

export function useCreateCollectionEntry(projectId?: string, collectionId?: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (entry: CollectionEntry) => collectionsApi.createEntry(projectId!, collectionId!, entry),
    onSuccess: () => {
      showToast('Entry created', 'success');
      void queryClient.invalidateQueries({ queryKey: collectionQueryKeys.entries(projectId!, collectionId!) });
    },
    onError: () => {
      showToast('Failed to create entry', 'error');
    }
  });
}

export function useUpdateCollectionEntry(projectId?: string, collectionId?: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ id, entry }: { id: string, entry: CollectionEntry }) => 
      collectionsApi.updateEntry(projectId!, collectionId!, id, entry),
    onSuccess: () => {
      showToast('Entry updated', 'success');
      void queryClient.invalidateQueries({ queryKey: collectionQueryKeys.entries(projectId!, collectionId!) });
      void queryClient.invalidateQueries({ queryKey: ['collections', 'history', projectId, collectionId] });
    },
    onError: () => {
      showToast('Failed to update entry', 'error');
    }
  });
}

export function useDeleteCollectionEntry(projectId?: string, collectionId?: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (id: string) => collectionsApi.deleteEntry(projectId!, collectionId!, id),
    onSuccess: () => {
      showToast('Entry deleted', 'success');
      void queryClient.invalidateQueries({ queryKey: collectionQueryKeys.entries(projectId!, collectionId!) });
    },
    onError: () => {
      showToast('Failed to delete entry', 'error');
    }
  });
}

export function useUpdateCollectionConfig(projectId?: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (config: CollectionConfig[]) => collectionsApi.updateConfig(projectId!, config),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collectionQueryKeys.lists(projectId!) });
    },
    onError: () => {
      showToast('Failed to update collection configuration', 'error');
    }
  });
}

export function useCollectionEntryHistory(projectId: string, collectionId: string, entryId: string, branch?: string) {
  return useQuery({
    queryKey: collectionQueryKeys.history(projectId, collectionId, entryId, branch),
    queryFn: () => collectionsApi.getEntryHistory(projectId, collectionId, entryId, branch),
    enabled: !!projectId && !!collectionId && !!entryId,
  });
}

export function useCollectionEntryVersion(projectId: string, collectionId: string, entryId: string, hash: string | null, branch?: string) {
  return useQuery({
    queryKey: collectionQueryKeys.version(projectId, collectionId, entryId, hash!, branch),
    queryFn: () => collectionsApi.getEntryVersion(projectId, collectionId, entryId, hash!, branch),
    enabled: !!projectId && !!collectionId && !!entryId && !!hash,
  });
}
