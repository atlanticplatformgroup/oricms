import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CollectionConfig,
  CollectionEntry,
  EntryBranchTransferApplyRequest,
  EntryBranchTransferDiffNode,
  EntryBranchTransferResolution,
} from '@ori/shared';
import { useToast } from '../contexts/ToastContext';
import { collectionsApi } from '../lib/api/collections';
import { gitApi } from '../lib/api/git';
import { collectionQueryKeys } from './queries/useCollectionQueries';

function flattenPointers(nodes: EntryBranchTransferDiffNode[]): string[] {
  return nodes.flatMap((node) => [node.pointer, ...flattenPointers(node.children ?? [])]);
}

function isAncestorPointer(ancestor: string, pointer: string): boolean {
  return pointer === ancestor || pointer.startsWith(`${ancestor}/`);
}

export function useEntryBranchTransfer({
  projectId,
  selectedCollection,
  selectedEntry,
  currentBranchName,
  canUpdateEntries,
}: {
  projectId: string | null;
  selectedCollection: CollectionConfig | null;
  selectedEntry: CollectionEntry | null;
  currentBranchName: string;
  canUpdateEntries: boolean;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [opened, setOpened] = useState(false);
  const [targetBranch, setTargetBranch] = useState<string | null>(null);
  const [mode, setMode] = useState<EntryBranchTransferApplyRequest['mode']>('entire_entry');
  const [selectedPointers, setSelectedPointers] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [resolutions, setResolutions] = useState<Record<string, EntryBranchTransferResolution['strategy']>>({});

  const branchesQuery = useQuery({
    queryKey: ['git', 'branches', projectId],
    queryFn: () => gitApi.getBranches(projectId!),
    enabled: opened && Boolean(projectId),
  });

  const previewQuery = useQuery({
    queryKey: ['collections', 'entry-branch-transfer', projectId, selectedCollection?.id, selectedEntry?.$id, currentBranchName, targetBranch],
    queryFn: () =>
      collectionsApi.previewEntryBranchTransfer(projectId!, selectedCollection!.id, selectedEntry!.$id, {
        sourceBranch: currentBranchName,
        targetBranch: targetBranch!,
      }),
    enabled: opened && Boolean(projectId && selectedCollection && selectedEntry && targetBranch),
  });

  useEffect(() => {
    if (!opened) {
      setTargetBranch(null);
      setMode('entire_entry');
      setSelectedPointers([]);
      setResolutions({});
      setMessage('');
      return;
    }
  }, [opened]);

  useEffect(() => {
    if (!opened || targetBranch || !branchesQuery.data) return;
    const firstTarget = branchesQuery.data.branches.find((branch) => branch.name !== currentBranchName)?.name ?? null;
    setTargetBranch(firstTarget);
  }, [opened, branchesQuery.data, targetBranch, currentBranchName]);

  useEffect(() => {
    if (!previewQuery.data) return;
    setMessage(previewQuery.data.defaultCommitMessage);

    if (!previewQuery.data.modeAvailability.selected_paths && mode === 'selected_paths') {
      setMode('entire_entry');
    }

    if (previewQuery.data.modeAvailability.selected_paths) {
      setSelectedPointers((previous) => previous.length > 0 ? previous : previewQuery.data.diffTree.map((node) => node.pointer));
    } else {
      setSelectedPointers([]);
    }

    setResolutions({});
  }, [previewQuery.data, mode]);

  const branchOptions = useMemo(
    () =>
      (branchesQuery.data?.branches ?? [])
        .filter((branch) => branch.name !== currentBranchName)
        .map((branch) => ({ value: branch.name, label: branch.name })),
    [branchesQuery.data?.branches, currentBranchName],
  );

  const selectedConflictPointers = useMemo(() => {
    const conflicts = previewQuery.data?.conflicts ?? [];
    return conflicts
      .filter((conflict) => selectedPointers.some((pointer) => isAncestorPointer(pointer, conflict.pointer) || isAncestorPointer(conflict.pointer, pointer)))
      .map((conflict) => conflict.pointer);
  }, [previewQuery.data?.conflicts, selectedPointers]);

  const unresolvedConflictPointers = useMemo(
    () => selectedConflictPointers.filter((pointer) => !resolutions[pointer]),
    [selectedConflictPointers, resolutions],
  );

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!projectId || !selectedCollection || !selectedEntry || !targetBranch) {
        throw new Error('Branch transfer is not ready');
      }

      return collectionsApi.applyEntryBranchTransfer(projectId, selectedCollection.id, selectedEntry.$id, {
        sourceBranch: currentBranchName,
        targetBranch,
        mode,
        selectedPointers: mode === 'selected_paths' ? selectedPointers : undefined,
        resolutions: Object.entries(resolutions).map(([pointer, strategy]) => ({ pointer, strategy })),
        message,
      });
    },
    onSuccess: async (result) => {
      if (!projectId || !selectedCollection || !selectedEntry || !targetBranch) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: collectionQueryKeys.entries(projectId, selectedCollection.id) }),
        queryClient.invalidateQueries({ queryKey: ['collections', 'entry', projectId, selectedCollection.id, selectedEntry.$id] }),
        queryClient.invalidateQueries({ queryKey: ['collections', 'history', projectId, selectedCollection.id, selectedEntry.$id] }),
        queryClient.invalidateQueries({ queryKey: ['git', 'branches', projectId] }),
      ]);

      showToast(
        mode === 'entire_entry'
          ? `Copied entry to ${targetBranch}`
          : `Applied ${result.appliedPointerCount} ${result.appliedPointerCount === 1 ? 'change' : 'changes'} to ${targetBranch}`,
        'success',
      );
      setOpened(false);
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Failed to apply branch copy', 'error');
    },
  });

  const canOpen = Boolean(projectId && selectedCollection && selectedEntry && canUpdateEntries);
  const canApply = Boolean(
    targetBranch &&
    message.trim() &&
    (previewQuery.data?.schemaCompatibility.matches ?? true) &&
    (
      mode === 'entire_entry' ||
      (selectedPointers.length > 0 && unresolvedConflictPointers.length === 0)
    ),
  );

  return {
    opened,
    setOpened,
    canOpen,
    targetBranch,
    setTargetBranch,
    mode,
    setMode,
    message,
    setMessage,
    selectedPointers,
    setSelectedPointers,
    resolutions,
    setResolution: (pointer: string, strategy: EntryBranchTransferResolution['strategy']) =>
      setResolutions((previous) => ({ ...previous, [pointer]: strategy })),
    branchesLoading: branchesQuery.isLoading,
    branchOptions,
    preview: previewQuery.data ?? null,
    previewLoading: previewQuery.isLoading,
    previewError: previewQuery.isError,
    retryPreview: () => void previewQuery.refetch(),
    applyPending: applyMutation.isPending,
    canApply,
    unresolvedConflictPointers,
    applyTransfer: () => void applyMutation.mutate(),
    flattenPointers,
  };
}
