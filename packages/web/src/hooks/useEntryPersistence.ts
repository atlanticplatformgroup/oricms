import { useCallback } from 'react';
import { useMutation, type QueryClient } from '@tanstack/react-query';
import type { CollectionConfig, CollectionEntry } from '@ori/shared';
import { collectionsApi } from '../lib/api/collections';
import { ApiError } from '../lib/api/core';
import { getDisplayText } from '../lib/workspace/format';
import { collectionQueryKeys } from './queries/useCollectionQueries';

type ShowToast = (message: string, tone?: 'success' | 'error' | 'info') => void;

export function useEntryPersistence({
  canCreateEntries,
  canDeleteEntries,
  canUpdateEntries,
  commitMessage,
  currentRevision,
  draftEntry,
  editorValidationCount,
  entries,
  isDirty,
  onNavigateToCollection,
  onNavigateToEntry,
  primaryField,
  projectId,
  queryClient,
  selectedCollection,
  selectedEntry,
  setBaselineEntry,
  setCommitMessage,
  setCurrentRevision,
  setDraftEntry,
  setShowCommitBar,
  showToast,
}: {
  canCreateEntries: boolean;
  canDeleteEntries: boolean;
  canUpdateEntries: boolean;
  commitMessage: string;
  currentRevision: string | null;
  draftEntry: CollectionEntry | null;
  editorValidationCount: number;
  entries: CollectionEntry[];
  isDirty: boolean;
  onNavigateToCollection: () => void;
  onNavigateToEntry: (entryId: string) => void;
  primaryField: string;
  projectId: string | null;
  queryClient: QueryClient;
  selectedCollection: CollectionConfig | null;
  selectedEntry: CollectionEntry | null;
  setBaselineEntry: (entry: CollectionEntry | null) => void;
  setCommitMessage: (value: string) => void;
  setCurrentRevision: (value: string | null) => void;
  setDraftEntry: (entry: CollectionEntry | null) => void;
  setShowCommitBar: (value: boolean) => void;
  showToast: ShowToast;
}) {
  const updateEntryMutation = useMutation({
    mutationFn: ({ collectionId, entryId, data }: { collectionId: string; entryId: string; data: Partial<CollectionEntry> }) =>
      collectionsApi.updateEntry(projectId!, collectionId, entryId, data, currentRevision ?? undefined),
    onSuccess: (result, variables) => {
      setBaselineEntry(JSON.parse(JSON.stringify(result.entry)) as CollectionEntry);
      setDraftEntry(JSON.parse(JSON.stringify(result.entry)) as CollectionEntry);
      setCurrentRevision(result.meta?.revision ?? currentRevision);
      setShowCommitBar(false);
      setCommitMessage('');
      showToast('Entry saved', 'success');
      void queryClient.invalidateQueries({ queryKey: collectionQueryKeys.entries(projectId!, variables.collectionId) });
      void queryClient.invalidateQueries({ queryKey: ['collections', 'entry', projectId!] });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'STALE_REVISION') {
        showToast('This entry changed in another session. Reload before saving.', 'error');
        if (selectedCollection && selectedEntry) {
          void queryClient.invalidateQueries({ queryKey: ['collections', 'entry', projectId!] });
        }
        return;
      }
      showToast('Failed to save entry', 'error');
    },
  });

  const createEntryMutation = useMutation({
    mutationFn: ({ collectionId, data }: { collectionId: string; data: Partial<CollectionEntry> }) =>
      collectionsApi.createEntry(projectId!, collectionId, data),
    onSuccess: (_, variables) => {
      showToast('Entry created', 'success');
      void queryClient.invalidateQueries({ queryKey: collectionQueryKeys.entries(projectId!, variables.collectionId) });
    },
    onError: () => showToast('Failed to create entry', 'error'),
  });

  const deleteEntryMutation = useMutation({
    mutationFn: ({ collectionId, entryId }: { collectionId: string; entryId: string }) =>
      collectionsApi.deleteEntry(projectId!, collectionId, entryId, currentRevision ?? undefined),
    onSuccess: (_, variables) => {
      showToast('Entry deleted', 'success');
      void queryClient.invalidateQueries({ queryKey: collectionQueryKeys.entries(projectId!, variables.collectionId) });
      void queryClient.invalidateQueries({ queryKey: ['collections', 'entry', projectId!] });
      onNavigateToCollection();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'STALE_REVISION') {
        showToast('This entry changed in another session. Reload before deleting.', 'error');
        if (selectedCollection && selectedEntry) {
          void queryClient.invalidateQueries({ queryKey: ['collections', 'entry', projectId!] });
        }
        return;
      }
      showToast('Failed to delete entry', 'error');
    },
  });

  const handleSaveEntry = useCallback(() => {
    if (!draftEntry || !isDirty || !canUpdateEntries) return;
    if (editorValidationCount > 0) {
      showToast(`Resolve ${editorValidationCount} validation ${editorValidationCount === 1 ? 'issue' : 'issues'} before saving`, 'error');
      return;
    }
    if (!commitMessage.trim()) {
      const label = selectedCollection?.singularLabel || 'entry';
      setCommitMessage(`Update ${label}`);
    }
    setShowCommitBar(true);
  }, [canUpdateEntries, commitMessage, draftEntry, editorValidationCount, isDirty, selectedCollection?.singularLabel, setCommitMessage, setShowCommitBar, showToast]);

  const handleDeleteEntry = async () => {
    if (!selectedCollection || !selectedEntry || !canDeleteEntries) return;
    if (!window.confirm(`Delete entry "${getDisplayText(selectedEntry[primaryField] ?? selectedEntry.$id)}"?`)) return;
    await deleteEntryMutation.mutateAsync({ collectionId: selectedCollection.id, entryId: selectedEntry.$id });
  };

  const handleCommitEntry = async () => {
    if (!draftEntry || !selectedCollection || !selectedEntry) return;
    if (editorValidationCount > 0) {
      showToast(`Resolve ${editorValidationCount} validation ${editorValidationCount === 1 ? 'issue' : 'issues'} before committing`, 'error');
      return;
    }
    try {
      await updateEntryMutation.mutateAsync({ collectionId: selectedCollection.id, entryId: selectedEntry.$id, data: draftEntry });
      if (commitMessage.trim()) {
        showToast(`Commit: ${commitMessage.trim()}`, 'info');
      }
    } catch {
      // toast handled by mutation
    }
  };

  const handleRestoreVersion = async (versionEntry: CollectionEntry, revisionHash: string | null) => {
    if (!selectedCollection || !selectedEntry || !canUpdateEntries) return;
    const restoredEntry: Partial<CollectionEntry> = {
      ...versionEntry,
      $id: selectedEntry.$id,
      $type: selectedEntry.$type,
      $updatedAt: new Date().toISOString(),
    };
    await updateEntryMutation.mutateAsync({
      collectionId: selectedCollection.id,
      entryId: selectedEntry.$id,
      data: restoredEntry,
    });
    showToast(`Restored revision ${revisionHash?.slice(0, 8) || ''}`, 'success');
  };

  const handleNewEntry = async () => {
    if (!selectedCollection || !projectId || !canCreateEntries) return;
    const seedTitle = `Untitled ${entries.length + 1}`;
    const seed: Partial<CollectionEntry> = { $status: 'draft', $type: selectedCollection.contentType, [primaryField]: seedTitle };
    try {
      const result = await createEntryMutation.mutateAsync({ collectionId: selectedCollection.id, data: seed });
      onNavigateToEntry(result.entry.$id);
    } catch {
      // toast handled by mutation
    }
  };

  return {
    createEntryMutation,
    deleteEntryMutation,
    handleCommitEntry,
    handleDeleteEntry,
    handleNewEntry,
    handleRestoreVersion,
    handleSaveEntry,
    updateEntryMutation,
  };
}
