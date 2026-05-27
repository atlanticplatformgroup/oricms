import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CollectionConfig, CollectionEntry } from '@ori/shared';
import { collectionsApi } from '../lib/api/collections';
import { createFieldDiffs, normalizeHistoryItem, stripSystemFields } from '../lib/entries/transforms';
import type { FieldDiff, HistoryTimelineItem } from '../lib/entries/types';

interface UseEntryHistoryOptions {
  projectId: string | null;
  selectedCollection: CollectionConfig | null;
  selectedEntry: CollectionEntry | null;
  activeHistoryView: boolean;
  canUpdateEntries: boolean;
  currentBranchName: string;
  onRestoreRevision: (versionEntry: CollectionEntry, revisionHash: string | null) => Promise<void>;
}

interface UseEntryHistoryResult {
  restoreConfirmOpened: boolean;
  openRestoreConfirm: () => void;
  closeRestoreConfirm: () => void;
  selectedHistoryHash: string | null;
  setSelectedHistoryHash: (hash: string | null) => void;
  selectedCompareHash: string | null;
  setSelectedCompareHash: (hash: string | null) => void;
  historyTimelineItems: HistoryTimelineItem[];
  historyChangedCountsByHash: Record<string, number>;
  comparisonTargetLabel: string;
  comparisonSummary: string;
  selectedHistoryItem: HistoryTimelineItem | null;
  selectedCompareItem: HistoryTimelineItem | null;
  historyFieldDiffs: FieldDiff[];
  restoreDisabledReason: string;
  historyLoading: boolean;
  historyError: boolean;
  retryHistory: () => void;
  selectedHistoryVersionLoading: boolean;
  selectedCompareVersionLoading: boolean;
  selectedHistoryVersionError: boolean;
  selectedCompareVersionError: boolean;
  retryHistoryVersions: () => void;
  selectedHistoryVersionData: CollectionEntry | null;
  handleRestoreSelectedRevision: () => Promise<void>;
  restorePending: boolean;
}

export function useEntryHistory({
  projectId,
  selectedCollection,
  selectedEntry,
  activeHistoryView,
  canUpdateEntries,
  currentBranchName,
  onRestoreRevision,
}: UseEntryHistoryOptions): UseEntryHistoryResult {
  const [restoreConfirmOpened, setRestoreConfirmOpened] = useState(false);
  const [selectedHistoryHash, setSelectedHistoryHash] = useState<string | null>(null);
  const [selectedCompareHash, setSelectedCompareHash] = useState<string | null>(null);
  const [restorePending, setRestorePending] = useState(false);

  const entryHistoryQuery = useQuery({
    queryKey: ['collections', 'history', projectId, selectedCollection?.id, selectedEntry?.$id],
    queryFn: async () => {
      if (!projectId || !selectedCollection || !selectedEntry) return [];
      const result = await collectionsApi.getEntryHistory(projectId, selectedCollection.id, selectedEntry.$id);
      return result.history || [];
    },
    enabled: Boolean(activeHistoryView && projectId && selectedCollection && selectedEntry),
  });

  const historyHashes = useMemo(
    () =>
      (entryHistoryQuery.data || []).map((item, index) =>
        String(item.hash || (item as unknown as Record<string, unknown>).commit || (item as unknown as Record<string, unknown>).id || `rev-${index}`),
      ),
    [entryHistoryQuery.data],
  );

  const historyTimelineItems = useMemo(
    () => (entryHistoryQuery.data || []).map((item, index) => normalizeHistoryItem(item, index)),
    [entryHistoryQuery.data],
  );

  const selectedHistoryItem = useMemo(
    () => historyTimelineItems.find((item) => item.hash === selectedHistoryHash) ?? null,
    [historyTimelineItems, selectedHistoryHash],
  );

  const selectedCompareItem = useMemo(
    () => historyTimelineItems.find((item) => item.hash === selectedCompareHash) ?? null,
    [historyTimelineItems, selectedCompareHash],
  );

  const selectedHistoryVersionQuery = useQuery({
    queryKey: ['collections', 'version', projectId, selectedCollection?.id, selectedEntry?.$id, selectedHistoryHash],
    queryFn: async () => {
      if (!projectId || !selectedCollection || !selectedEntry || !selectedHistoryHash) return null;
      const result = await collectionsApi.getEntryVersion(projectId, selectedCollection.id, selectedEntry.$id, selectedHistoryHash);
      return result.entry as CollectionEntry;
    },
    enabled: Boolean(activeHistoryView && projectId && selectedCollection && selectedEntry && selectedHistoryHash),
  });

  const selectedCompareVersionQuery = useQuery({
    queryKey: ['collections', 'version', projectId, selectedCollection?.id, selectedEntry?.$id, selectedCompareHash],
    queryFn: async () => {
      if (!projectId || !selectedCollection || !selectedEntry || !selectedCompareHash) return null;
      const result = await collectionsApi.getEntryVersion(projectId, selectedCollection.id, selectedEntry.$id, selectedCompareHash);
      return result.entry as CollectionEntry;
    },
    enabled: Boolean(activeHistoryView && projectId && selectedCollection && selectedEntry && selectedCompareHash),
  });

  const historyEntriesByHashQuery = useQuery({
    queryKey: ['collections', 'history-entries-by-hash', projectId, selectedCollection?.id, selectedEntry?.$id, historyHashes.join(',')],
    queryFn: async () => {
      if (!projectId || !selectedCollection || !selectedEntry || historyHashes.length === 0) {
        return {} as Record<string, Record<string, unknown> | null>;
      }
      const pairs = await Promise.all(
        historyHashes.map(async (hash) => {
          try {
            const result = await collectionsApi.getEntryVersion(projectId, selectedCollection.id, selectedEntry.$id, hash);
            return [hash, stripSystemFields(result.entry) as Record<string, unknown>] as const;
          } catch {
            return [hash, null] as const;
          }
        }),
      );
      return Object.fromEntries(pairs) as Record<string, Record<string, unknown> | null>;
    },
    enabled: Boolean(activeHistoryView && projectId && selectedCollection && selectedEntry && historyHashes.length > 0),
  });

  useEffect(() => {
    setSelectedHistoryHash(null);
    setSelectedCompareHash(null);
    setRestoreConfirmOpened(false);
  }, [selectedEntry?.$id]);

  useEffect(() => {
    if (!activeHistoryView) return;
    if (selectedHistoryHash) return;
    const first = entryHistoryQuery.data?.[0] as Record<string, unknown> | undefined;
    if (!first) return;
    const nextHash = String(first.hash || first.commit || first.id || '');
    if (nextHash) {
      setSelectedHistoryHash(nextHash);
    }
  }, [activeHistoryView, selectedHistoryHash, entryHistoryQuery.data]);

  useEffect(() => {
    if (!activeHistoryView) return;
    if (!selectedCompareHash) return;
    if (!historyHashes.includes(selectedCompareHash)) {
      setSelectedCompareHash(null);
    }
  }, [activeHistoryView, selectedCompareHash, historyHashes]);

  const historyFieldDiffs = useMemo(() => {
    if (!selectedEntry || !selectedHistoryVersionQuery.data) return [];
    const base = (selectedCompareVersionQuery.data
      ? stripSystemFields(selectedCompareVersionQuery.data)
      : stripSystemFields(selectedEntry)) as Record<string, unknown>;
    const target = stripSystemFields(selectedHistoryVersionQuery.data) as Record<string, unknown>;
    return createFieldDiffs(base, target);
  }, [selectedEntry, selectedHistoryVersionQuery.data, selectedCompareVersionQuery.data]);

  const historyChangedCountsByHash = useMemo(() => {
    const byHash = historyEntriesByHashQuery.data || {};
    const counts: Record<string, number> = {};

    historyHashes.forEach((hash, index) => {
      const currentVersion = byHash[hash];
      const previousHash = historyHashes[index + 1];
      const previousVersion = previousHash ? byHash[previousHash] : {};
      if (!currentVersion) return;
      counts[hash] = createFieldDiffs(
        (previousVersion || {}) as Record<string, unknown>,
        currentVersion as Record<string, unknown>,
      ).length;
    });

    return counts;
  }, [historyEntriesByHashQuery.data, historyHashes]);

  const comparisonTargetLabel = selectedCompareItem ? `Revision ${selectedCompareItem.hash.slice(0, 8)}` : 'Current draft';

  const comparisonSummary = useMemo(() => {
    if (!selectedHistoryItem) {
      return 'Select a revision to begin comparing';
    }

    return `Comparing revision ${selectedHistoryItem.hash.slice(0, 8)} against ${comparisonTargetLabel}`;
  }, [comparisonTargetLabel, selectedHistoryItem]);

  const restoreDisabledReason = useMemo(() => {
    if (!canUpdateEntries) {
      return 'Restore is unavailable because you do not have permission to update entries.';
    }

    if (!selectedHistoryVersionQuery.data) {
      return 'Restore becomes available after a revision is fully loaded.';
    }

    if (historyFieldDiffs.length === 0) {
      return 'Restore is unavailable because there are no differing fields in this comparison.';
    }

    return `Restoring writes the selected revision back as a new commit on ${currentBranchName}. Existing history is preserved.`;
  }, [canUpdateEntries, currentBranchName, selectedHistoryVersionQuery.data, historyFieldDiffs.length]);

  const handleRestoreSelectedRevision = async () => {
    if (!selectedHistoryVersionQuery.data || !canUpdateEntries || restorePending) return;
    setRestorePending(true);
    try {
      await onRestoreRevision(selectedHistoryVersionQuery.data, selectedHistoryHash);
      setRestoreConfirmOpened(false);
    } finally {
      setRestorePending(false);
    }
  };

  return {
    restoreConfirmOpened,
    openRestoreConfirm: () => setRestoreConfirmOpened(true),
    closeRestoreConfirm: () => setRestoreConfirmOpened(false),
    selectedHistoryHash,
    setSelectedHistoryHash,
    selectedCompareHash,
    setSelectedCompareHash,
    historyTimelineItems,
    historyChangedCountsByHash,
    comparisonTargetLabel,
    comparisonSummary,
    selectedHistoryItem,
    selectedCompareItem,
    historyFieldDiffs,
    restoreDisabledReason,
    historyLoading: entryHistoryQuery.isLoading,
    historyError: entryHistoryQuery.isError,
    retryHistory: () => void entryHistoryQuery.refetch(),
    selectedHistoryVersionLoading: selectedHistoryVersionQuery.isLoading,
    selectedCompareVersionLoading: selectedCompareVersionQuery.isLoading,
    selectedHistoryVersionError: selectedHistoryVersionQuery.isError,
    selectedCompareVersionError: selectedCompareVersionQuery.isError,
    retryHistoryVersions: () => {
      void selectedHistoryVersionQuery.refetch();
      if (selectedCompareHash) void selectedCompareVersionQuery.refetch();
    },
    selectedHistoryVersionData: selectedHistoryVersionQuery.data ?? null,
    handleRestoreSelectedRevision,
    restorePending,
  };
}
