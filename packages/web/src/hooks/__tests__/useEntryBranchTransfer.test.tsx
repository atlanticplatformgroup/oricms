import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CollectionConfig, CollectionEntry, EntryBranchTransferDiffNode } from '@ori/shared';
import { useEntryBranchTransfer } from '../useEntryBranchTransfer';

const getBranchesMock = vi.fn();
const previewEntryBranchTransferMock = vi.fn();
const applyEntryBranchTransferMock = vi.fn();

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../../lib/api/git', () => ({
  gitApi: {
    getBranches: (...args: unknown[]) => getBranchesMock(...args),
  },
}));

vi.mock('../../lib/api/collections', () => ({
  collectionsApi: {
    previewEntryBranchTransfer: (...args: unknown[]) => previewEntryBranchTransferMock(...args),
    applyEntryBranchTransfer: (...args: unknown[]) => applyEntryBranchTransferMock(...args),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useEntryBranchTransfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const selectedCollection: CollectionConfig = { id: 'posts', label: 'Posts', contentType: 'post', path: 'posts' };
  const selectedEntry: CollectionEntry = {
    $id: 'entry-1', $type: 'post', $status: 'draft', $createdAt: '', $updatedAt: '',
  };

  it('returns closed state initially', () => {
    const { result } = renderHook(
      () => useEntryBranchTransfer({
        projectId: 'project-1',
        selectedCollection,
        selectedEntry,
        currentBranchName: 'main',
        canUpdateEntries: true,
      }),
      { wrapper: createWrapper() },
    );

    expect(result.current.opened).toBe(false);
    expect(result.current.canOpen).toBe(true);
    expect(result.current.canApply).toBe(false);
  });

  it('canOpen is false when missing data', () => {
    const { result } = renderHook(
      () => useEntryBranchTransfer({
        projectId: null,
        selectedCollection: null,
        selectedEntry: null,
        currentBranchName: 'main',
        canUpdateEntries: true,
      }),
      { wrapper: createWrapper() },
    );

    expect(result.current.canOpen).toBe(false);
  });

  it('fetches branches when opened', async () => {
    getBranchesMock.mockResolvedValue({ branches: [{ name: 'main' }, { name: 'staging' }], current: 'main' });

    const { result } = renderHook(
      () => useEntryBranchTransfer({
        projectId: 'project-1',
        selectedCollection,
        selectedEntry,
        currentBranchName: 'main',
        canUpdateEntries: true,
      }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.setOpened(true));

    await waitFor(() => expect(result.current.branchOptions).toHaveLength(1));
    expect(result.current.branchOptions[0]).toEqual({ value: 'staging', label: 'staging' });
  });

  it('auto-selects first non-current branch', async () => {
    getBranchesMock.mockResolvedValue({ branches: [{ name: 'main' }, { name: 'staging' }], current: 'main' });

    const { result } = renderHook(
      () => useEntryBranchTransfer({
        projectId: 'project-1',
        selectedCollection,
        selectedEntry,
        currentBranchName: 'main',
        canUpdateEntries: true,
      }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.setOpened(true));

    await waitFor(() => expect(result.current.targetBranch).toBe('staging'));
  });

  it('resets state when closed', async () => {
    getBranchesMock.mockResolvedValue({ branches: [{ name: 'main' }, { name: 'staging' }], current: 'main' });
    previewEntryBranchTransferMock.mockResolvedValue({
      defaultCommitMessage: 'Transfer entry',
      modeAvailability: { selected_paths: false },
      schemaCompatibility: { matches: true },
      diffTree: [],
      conflicts: [],
    });

    const { result } = renderHook(
      () => useEntryBranchTransfer({
        projectId: 'project-1',
        selectedCollection,
        selectedEntry,
        currentBranchName: 'main',
        canUpdateEntries: true,
      }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.setOpened(true));
    await waitFor(() => expect(result.current.targetBranch).toBe('staging'));

    act(() => result.current.setOpened(false));

    expect(result.current.targetBranch).toBeNull();
    expect(result.current.mode).toBe('entire_entry');
    expect(result.current.selectedPointers).toEqual([]);
  });

  it('computes canApply for entire entry mode', async () => {
    getBranchesMock.mockResolvedValue({ branches: [{ name: 'staging' }], current: 'main' });
    previewEntryBranchTransferMock.mockResolvedValue({
      defaultCommitMessage: 'Transfer',
      modeAvailability: { selected_paths: false },
      schemaCompatibility: { matches: true },
      diffTree: [],
      conflicts: [],
    });

    const { result } = renderHook(
      () => useEntryBranchTransfer({
        projectId: 'project-1',
        selectedCollection,
        selectedEntry,
        currentBranchName: 'main',
        canUpdateEntries: true,
      }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.setOpened(true));
    await waitFor(() => expect(result.current.preview).not.toBeNull());

    expect(result.current.canApply).toBe(true);
  });

  it('computes canApply for selected paths mode', async () => {
    getBranchesMock.mockResolvedValue({ branches: [{ name: 'staging' }], current: 'main' });
    previewEntryBranchTransferMock.mockResolvedValue({
      defaultCommitMessage: 'Transfer',
      modeAvailability: { selected_paths: true },
      schemaCompatibility: { matches: true },
      diffTree: [{ pointer: 'title' } as EntryBranchTransferDiffNode],
      conflicts: [],
    });

    const { result } = renderHook(
      () => useEntryBranchTransfer({
        projectId: 'project-1',
        selectedCollection,
        selectedEntry,
        currentBranchName: 'main',
        canUpdateEntries: true,
      }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.setOpened(true));
    await waitFor(() => expect(result.current.preview?.modeAvailability.selected_paths).toBe(true));

    act(() => result.current.setMode('selected_paths'));

    await waitFor(() => expect(result.current.selectedPointers).toContain('title'));
    expect(result.current.canApply).toBe(true);
  });

  it('blocks apply when schema incompatible', async () => {
    getBranchesMock.mockResolvedValue({ branches: [{ name: 'staging' }], current: 'main' });
    previewEntryBranchTransferMock.mockResolvedValue({
      defaultCommitMessage: 'Transfer',
      modeAvailability: { selected_paths: false },
      schemaCompatibility: { matches: false },
      diffTree: [],
      conflicts: [],
    });

    const { result } = renderHook(
      () => useEntryBranchTransfer({
        projectId: 'project-1',
        selectedCollection,
        selectedEntry,
        currentBranchName: 'main',
        canUpdateEntries: true,
      }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.setOpened(true));
    await waitFor(() => expect(result.current.preview).not.toBeNull());

    expect(result.current.canApply).toBe(false);
  });

  it('computes unresolved conflict pointers', async () => {
    getBranchesMock.mockResolvedValue({ branches: [{ name: 'staging' }], current: 'main' });
    previewEntryBranchTransferMock.mockResolvedValue({
      defaultCommitMessage: 'Transfer',
      modeAvailability: { selected_paths: true },
      schemaCompatibility: { matches: true },
      diffTree: [{ pointer: 'title' } as EntryBranchTransferDiffNode],
      conflicts: [{ pointer: 'title' }],
    });

    const { result } = renderHook(
      () => useEntryBranchTransfer({
        projectId: 'project-1',
        selectedCollection,
        selectedEntry,
        currentBranchName: 'main',
        canUpdateEntries: true,
      }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.setOpened(true));
    await waitFor(() => expect(result.current.preview?.conflicts).toHaveLength(1));

    act(() => result.current.setMode('selected_paths'));
    await waitFor(() => expect(result.current.selectedPointers).toContain('title'));

    expect(result.current.unresolvedConflictPointers).toContain('title');
    expect(result.current.canApply).toBe(false);

    act(() => result.current.setResolution('title', 'target'));

    await waitFor(() => expect(result.current.unresolvedConflictPointers).toHaveLength(0));
    expect(result.current.canApply).toBe(true);
  });

  it('applies branch transfer', async () => {
    getBranchesMock.mockResolvedValue({ branches: [{ name: 'staging' }], current: 'main' });
    previewEntryBranchTransferMock.mockResolvedValue({
      defaultCommitMessage: 'Transfer',
      modeAvailability: { selected_paths: false },
      schemaCompatibility: { matches: true },
      diffTree: [],
      conflicts: [],
    });
    applyEntryBranchTransferMock.mockResolvedValue({ appliedPointerCount: 1 });

    const { result } = renderHook(
      () => useEntryBranchTransfer({
        projectId: 'project-1',
        selectedCollection,
        selectedEntry,
        currentBranchName: 'main',
        canUpdateEntries: true,
      }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.setOpened(true));
    await waitFor(() => expect(result.current.canApply).toBe(true));

    act(() => result.current.applyTransfer());

    await waitFor(() => expect(applyEntryBranchTransferMock).toHaveBeenCalled());
  });
});
