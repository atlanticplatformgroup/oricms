import { useEffect, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { NavigateFunction } from 'react-router-dom';
import { gitApi } from '../lib/api/git';
import { buildWorkspacePath } from '../lib/workspace/routing';
import type { SchemaMode, SectionKey } from '../lib/workspace/types';

interface UseWorkspaceBranchSyncOptions {
  projectId: string | null;
  projectDefaultBranch: string | null;
  activeProjectSlug: string | null;
  activeBranchName: string | null;
  activeSection: SectionKey;
  activeSecondaryId: string | null;
  activeEntryId: string | null;
  activeSchemaMode: SchemaMode;
  activeHistoryView: boolean;
  activeCollectionSettingsView: boolean;
  gitBranchName: string | null | undefined;
  queryClient: QueryClient;
  refreshGitStatus: () => Promise<unknown> | void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', options?: { duration?: number }) => void;
  navigate: NavigateFunction;
}

export function useWorkspaceBranchSync({
  projectId,
  projectDefaultBranch,
  activeProjectSlug,
  activeBranchName,
  activeSection,
  activeSecondaryId,
  activeEntryId,
  activeSchemaMode,
  activeHistoryView,
  activeCollectionSettingsView,
  gitBranchName,
  queryClient,
  refreshGitStatus,
  showToast,
  navigate,
}: UseWorkspaceBranchSyncOptions) {
  const branchSyncTargetRef = useRef<string | null>(null);
  const [resolvedGitBranchName, setResolvedGitBranchName] = useState<string | null>(null);

  useEffect(() => {
    if (!gitBranchName) return;
    setResolvedGitBranchName(gitBranchName);
  }, [gitBranchName]);

  const effectiveGitBranchName = resolvedGitBranchName ?? gitBranchName ?? projectDefaultBranch ?? 'main';
  const currentBranchName = activeBranchName ?? effectiveGitBranchName;
  const isBranchSyncing = Boolean(
    projectId
      && activeBranchName
      && effectiveGitBranchName
      && activeBranchName !== effectiveGitBranchName,
  );

  useEffect(() => {
    if (!projectId || !activeProjectSlug || !activeBranchName || !effectiveGitBranchName) return;
    if (activeBranchName === effectiveGitBranchName) {
      if (branchSyncTargetRef.current) {
        branchSyncTargetRef.current = null;
      }
      return;
    }
    if (branchSyncTargetRef.current === activeBranchName) return;

    let cancelled = false;
    branchSyncTargetRef.current = activeBranchName;

    void gitApi.switchBranch(projectId, activeBranchName)
      .then(async () => {
        if (cancelled) return;
        setResolvedGitBranchName(activeBranchName);
        await queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey)
            && (query.queryKey.includes(projectId)
              || query.queryKey[0] === 'type-schemas'
              || query.queryKey[0] === 'component-schemas'),
        });
        await refreshGitStatus();
      })
      .catch((error) => {
        if (cancelled) return;
        showToast(error instanceof Error ? error.message : 'Failed to switch branch', 'error');
        const fallbackBranchName = effectiveGitBranchName || projectDefaultBranch || 'main';
        setResolvedGitBranchName(fallbackBranchName);
        navigate(
          buildWorkspacePath(activeProjectSlug, activeSection, activeSecondaryId, {
            branchName: fallbackBranchName,
            entryId: activeEntryId,
            schemaMode: activeSchemaMode,
            historyView: activeHistoryView,
            collectionSettingsView: activeCollectionSettingsView,
          }),
          { replace: true },
        );
      })
      .finally(() => {
        if (!cancelled) {
          branchSyncTargetRef.current = null;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    projectId,
    projectDefaultBranch,
    activeProjectSlug,
    activeBranchName,
    effectiveGitBranchName,
    queryClient,
    refreshGitStatus,
    showToast,
    navigate,
    activeSection,
    activeSecondaryId,
    activeEntryId,
    activeSchemaMode,
    activeHistoryView,
    activeCollectionSettingsView,
  ]);

  return {
    effectiveGitBranchName,
    currentBranchName,
    isBranchSyncing,
    dataBranchName: isBranchSyncing ? effectiveGitBranchName : currentBranchName,
  };
}
