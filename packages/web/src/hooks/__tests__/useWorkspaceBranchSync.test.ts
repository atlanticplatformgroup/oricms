import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWorkspaceBranchSync } from '../useWorkspaceBranchSync';

function createQueryClient() {
  return {
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  } as unknown as import('@tanstack/react-query').QueryClient;
}

describe('useWorkspaceBranchSync', () => {
  it('returns default branch when no active branch', () => {
    const { result } = renderHook(() =>
      useWorkspaceBranchSync({
        projectId: 'proj-1',
        projectDefaultBranch: 'main',
        activeProjectSlug: 'proj',
        activeBranchName: null,
        activeSection: 'collections',
        activeSecondaryId: null,
        activeEntryId: null,
        activeSchemaMode: 'types',
        activeHistoryView: false,
        activeCollectionSettingsView: false,
        gitBranchName: 'main',
        queryClient: createQueryClient(),
        refreshGitStatus: vi.fn(),
        showToast: vi.fn(),
        navigate: vi.fn(),
      }),
    );

    expect(result.current.effectiveGitBranchName).toBe('main');
    expect(result.current.currentBranchName).toBe('main');
    expect(result.current.isBranchSyncing).toBe(false);
  });

  it('detects branch sync when active branch differs from git branch', () => {
    const { result } = renderHook(() =>
      useWorkspaceBranchSync({
        projectId: 'proj-1',
        projectDefaultBranch: 'main',
        activeProjectSlug: 'proj',
        activeBranchName: 'feature',
        activeSection: 'collections',
        activeSecondaryId: null,
        activeEntryId: null,
        activeSchemaMode: 'types',
        activeHistoryView: false,
        activeCollectionSettingsView: false,
        gitBranchName: 'main',
        queryClient: createQueryClient(),
        refreshGitStatus: vi.fn(),
        showToast: vi.fn(),
        navigate: vi.fn(),
      }),
    );

    expect(result.current.effectiveGitBranchName).toBe('main');
    expect(result.current.currentBranchName).toBe('feature');
    expect(result.current.isBranchSyncing).toBe(true);
  });

  it('does not detect sync when branches match', () => {
    const { result } = renderHook(() =>
      useWorkspaceBranchSync({
        projectId: 'proj-1',
        projectDefaultBranch: 'main',
        activeProjectSlug: 'proj',
        activeBranchName: 'main',
        activeSection: 'collections',
        activeSecondaryId: null,
        activeEntryId: null,
        activeSchemaMode: 'types',
        activeHistoryView: false,
        activeCollectionSettingsView: false,
        gitBranchName: 'main',
        queryClient: createQueryClient(),
        refreshGitStatus: vi.fn(),
        showToast: vi.fn(),
        navigate: vi.fn(),
      }),
    );

    expect(result.current.isBranchSyncing).toBe(false);
    expect(result.current.dataBranchName).toBe('main');
  });

  it('falls back to project default when git branch is unknown', () => {
    const { result } = renderHook(() =>
      useWorkspaceBranchSync({
        projectId: 'proj-1',
        projectDefaultBranch: 'staging',
        activeProjectSlug: 'proj',
        activeBranchName: null,
        activeSection: 'collections',
        activeSecondaryId: null,
        activeEntryId: null,
        activeSchemaMode: 'types',
        activeHistoryView: false,
        activeCollectionSettingsView: false,
        gitBranchName: undefined,
        queryClient: createQueryClient(),
        refreshGitStatus: vi.fn(),
        showToast: vi.fn(),
        navigate: vi.fn(),
      }),
    );

    expect(result.current.effectiveGitBranchName).toBe('staging');
  });

  it('uses dataBranchName fallback during sync', () => {
    const { result } = renderHook(() =>
      useWorkspaceBranchSync({
        projectId: 'proj-1',
        projectDefaultBranch: 'main',
        activeProjectSlug: 'proj',
        activeBranchName: 'feature',
        activeSection: 'collections',
        activeSecondaryId: null,
        activeEntryId: null,
        activeSchemaMode: 'types',
        activeHistoryView: false,
        activeCollectionSettingsView: false,
        gitBranchName: 'main',
        queryClient: createQueryClient(),
        refreshGitStatus: vi.fn(),
        showToast: vi.fn(),
        navigate: vi.fn(),
      }),
    );

    expect(result.current.isBranchSyncing).toBe(true);
    expect(result.current.dataBranchName).toBe('main');
  });

  it('uses currentBranchName as dataBranchName when not syncing', () => {
    const { result } = renderHook(() =>
      useWorkspaceBranchSync({
        projectId: 'proj-1',
        projectDefaultBranch: 'main',
        activeProjectSlug: 'proj',
        activeBranchName: 'main',
        activeSection: 'collections',
        activeSecondaryId: null,
        activeEntryId: null,
        activeSchemaMode: 'types',
        activeHistoryView: false,
        activeCollectionSettingsView: false,
        gitBranchName: 'main',
        queryClient: createQueryClient(),
        refreshGitStatus: vi.fn(),
        showToast: vi.fn(),
        navigate: vi.fn(),
      }),
    );

    expect(result.current.dataBranchName).toBe('main');
  });
});
