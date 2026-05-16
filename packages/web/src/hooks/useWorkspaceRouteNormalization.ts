import { useEffect } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { DEFAULT_SCHEMA_SECONDARY } from '../lib/workspace/constants';
import { getSectionSecondaryNavigation } from '../lib/workspace/registry';
import { buildWorkspacePath } from '../lib/workspace/routing';
import type { SchemaMode, SectionKey, SidebarOption } from '../lib/workspace/types';

interface UseWorkspaceRouteNormalizationOptions {
  activeProjectSlug: string | null;
  currentProjectSlug: string | null;
  pathname: string;
  navigate: NavigateFunction;
  availableSections: Array<{ key: SectionKey }>;
  activeSection: SectionKey;
  activeSecondaryId: string | null;
  currentBranchName: string;
  activeSchemaMode: SchemaMode;
  collections: Array<{ id: string }>;
  collectionsLoading: boolean;
  schemaSecondaryOptions: SidebarOption[];
  secondaryOptions: SidebarOption[];
  isBranchSyncing: boolean;
}

export function useWorkspaceRouteNormalization({
  activeProjectSlug,
  currentProjectSlug,
  pathname,
  navigate,
  availableSections,
  activeSection,
  activeSecondaryId,
  currentBranchName,
  activeSchemaMode,
  collections,
  collectionsLoading,
  schemaSecondaryOptions,
  secondaryOptions,
  isBranchSyncing,
}: UseWorkspaceRouteNormalizationOptions) {
  const isActiveProjectReady = Boolean(activeProjectSlug && currentProjectSlug === activeProjectSlug);

  useEffect(() => {
    if (!isActiveProjectReady || !activeProjectSlug) return;
    if (!availableSections.length) return;
    if (isBranchSyncing) return;

    if (!availableSections.some((section) => section.key === activeSection)) {
      const target = buildWorkspacePath(activeProjectSlug, availableSections[0].key, null, { branchName: currentBranchName });
      if (pathname !== target) {
        navigate(target, { replace: true });
      }
    }
  }, [isActiveProjectReady, activeProjectSlug, availableSections, activeSection, navigate, pathname, currentBranchName, isBranchSyncing]);

  useEffect(() => {
    if (!isActiveProjectReady || !activeProjectSlug) return;
    if (activeSection !== 'collections') return;
    if (collectionsLoading) return;
    if (isBranchSyncing) return;

    const hasCandidate = activeSecondaryId && collections.some((collection) => collection.id === activeSecondaryId);

    if (!hasCandidate) {
      const fallback = collections[0]?.id || null;
      const target = buildWorkspacePath(activeProjectSlug, 'collections', fallback, { branchName: currentBranchName });
      if (pathname !== target) {
        navigate(target, { replace: true });
      }
    }
  }, [isActiveProjectReady, activeProjectSlug, activeSection, collectionsLoading, isBranchSyncing, activeSecondaryId, collections, currentBranchName, pathname, navigate]);

  useEffect(() => {
    if (!isActiveProjectReady || !activeProjectSlug) return;
    if (activeSection !== 'schemas') return;
    if (isBranchSyncing) return;

    const hasOption = activeSecondaryId && schemaSecondaryOptions.some((option) => option.id === activeSecondaryId);
    if (!hasOption) {
      const fallback = schemaSecondaryOptions[0]?.id || DEFAULT_SCHEMA_SECONDARY;
      const target = buildWorkspacePath(activeProjectSlug, 'schemas', fallback, { schemaMode: activeSchemaMode, branchName: currentBranchName });
      if (pathname !== target) {
        navigate(target, { replace: true });
      }
    }
  }, [isActiveProjectReady, activeProjectSlug, activeSection, activeSecondaryId, schemaSecondaryOptions, activeSchemaMode, currentBranchName, pathname, navigate, isBranchSyncing]);

  useEffect(() => {
    if (!isActiveProjectReady || !activeProjectSlug) return;
    if (activeSection === 'collections' || activeSection === 'schemas') return;
    if (isBranchSyncing) return;
    if (getSectionSecondaryNavigation(activeSection) === 'inline') {
      if (!activeSecondaryId) return;
      const queryKey = activeSection === 'media' ? 'type' : 'view';
      const basePath = buildWorkspacePath(activeProjectSlug, activeSection, null, { branchName: currentBranchName });
      const target = `${basePath}?${queryKey}=${encodeURIComponent(activeSecondaryId)}`;
      if (pathname !== basePath) {
        navigate(target, { replace: true });
      }
      return;
    }

    const hasOption = activeSecondaryId && secondaryOptions.some((option) => option.id === activeSecondaryId);
    if (!hasOption) {
      const target = buildWorkspacePath(activeProjectSlug, activeSection, secondaryOptions[0]?.id, { branchName: currentBranchName });
      if (pathname !== target) {
        navigate(target, { replace: true });
      }
    }
  }, [isActiveProjectReady, activeProjectSlug, activeSection, activeSecondaryId, secondaryOptions, navigate, pathname, currentBranchName, isBranchSyncing]);
}
