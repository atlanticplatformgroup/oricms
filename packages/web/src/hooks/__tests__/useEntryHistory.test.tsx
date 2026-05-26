import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CollectionConfig, CollectionEntry } from '@ori/shared';
import { useEntryHistory } from '../useEntryHistory';

const getEntryHistoryMock = vi.fn();
const getEntryVersionMock = vi.fn();

vi.mock('../../lib/api/collections', () => ({
  collectionsApi: {
    getEntryHistory: (...args: unknown[]) => getEntryHistoryMock(...args),
    getEntryVersion: (...args: unknown[]) => getEntryVersionMock(...args),
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

describe('useEntryHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const selectedCollection: CollectionConfig = { id: 'posts', label: 'Posts', contentType: 'post', path: 'posts' };
  const selectedEntry: CollectionEntry = {
    $id: 'entry-1', $type: 'post', $status: 'draft', title: 'Hello', $createdAt: '2024-01-01T00:00:00Z', $updatedAt: '2024-01-02T00:00:00Z',
  };

  function createOptions(overrides: Partial<Parameters<typeof useEntryHistory>[0]> = {}) {
    return {
      projectId: 'project-1',
      selectedCollection,
      selectedEntry,
      activeHistoryView: true,
      canUpdateEntries: true,
      currentBranchName: 'main',
      onRestoreRevision: vi.fn(),
      ...overrides,
    };
  }

  it('returns empty state when not enabled', () => {
    const { result } = renderHook(() => useEntryHistory(createOptions({ activeHistoryView: false })), {
      wrapper: createWrapper(),
    });

    expect(result.current.historyTimelineItems).toEqual([]);
    expect(result.current.historyLoading).toBe(false);
  });

  it('loads history timeline items', async () => {
    getEntryHistoryMock.mockResolvedValue({
      history: [
        { hash: 'abc123', createdAt: '2024-01-02T00:00:00Z', message: 'Update' },
        { hash: 'def456', createdAt: '2024-01-01T00:00:00Z', message: 'Create' },
      ],
    });

    const { result } = renderHook(() => useEntryHistory(createOptions()), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.historyTimelineItems).toHaveLength(2));

    expect(result.current.historyTimelineItems[0].hash).toBe('abc123');
    expect(result.current.historyLoading).toBe(false);
    expect(result.current.historyError).toBe(false);
  });

  it('auto-selects first history item', async () => {
    getEntryHistoryMock.mockResolvedValue({
      history: [{ hash: 'abc123', createdAt: '2024-01-02T00:00:00Z', message: 'Update' }],
    });

    const { result } = renderHook(() => useEntryHistory(createOptions()), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.selectedHistoryHash).toBe('abc123'));
  });

  it('resets selection when entry changes', async () => {
    getEntryHistoryMock.mockResolvedValue({ history: [{ hash: 'abc123', createdAt: '2024-01-02T00:00:00Z' }] });

    const { result, rerender } = renderHook(
      ({ entry }) => useEntryHistory(createOptions({ selectedEntry: entry })),
      {
        wrapper: createWrapper(),
        initialProps: { entry: selectedEntry },
      },
    );

    await waitFor(() => expect(result.current.selectedHistoryHash).toBe('abc123'));

    act(() => result.current.setSelectedHistoryHash('def456'));
    expect(result.current.selectedHistoryHash).toBe('def456');

    rerender({ entry: { ...selectedEntry, $id: 'entry-2' } });

    expect(result.current.selectedHistoryHash).toBeNull();
    expect(result.current.selectedCompareHash).toBeNull();
    expect(result.current.restoreConfirmOpened).toBe(false);
  });

  it('clears compare hash if no longer in history', async () => {
    getEntryHistoryMock.mockResolvedValue({ history: [{ hash: 'abc123', createdAt: '2024-01-02T00:00:00Z' }] });

    const { result } = renderHook(() => useEntryHistory(createOptions()), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.historyTimelineItems).toHaveLength(1));

    act(() => result.current.setSelectedCompareHash('old-hash'));
    expect(result.current.selectedCompareHash).toBeNull();
  });

  it('loads selected history version', async () => {
    getEntryHistoryMock.mockResolvedValue({ history: [{ hash: 'abc123', createdAt: '2024-01-02T00:00:00Z' }] });
    getEntryVersionMock.mockResolvedValue({ entry: { ...selectedEntry, title: 'Old Title' } });

    const { result } = renderHook(() => useEntryHistory(createOptions()), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.selectedHistoryVersionData).not.toBeNull());

    expect(result.current.selectedHistoryVersionData?.title).toBe('Old Title');
    expect(result.current.selectedHistoryVersionLoading).toBe(false);
  });

  it('computes comparison target label', async () => {
    getEntryHistoryMock.mockResolvedValue({ history: [{ hash: 'abc123456', createdAt: '2024-01-02T00:00:00Z' }] });

    const { result } = renderHook(() => useEntryHistory(createOptions()), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.selectedHistoryItem).not.toBeNull());

    expect(result.current.comparisonTargetLabel).toBe('Current draft');

    act(() => result.current.setSelectedCompareHash('abc123456'));
    expect(result.current.comparisonTargetLabel).toBe('Revision abc12345');
  });

  it('restore is disabled without permission', async () => {
    getEntryHistoryMock.mockResolvedValue({ history: [{ hash: 'abc123', createdAt: '2024-01-02T00:00:00Z' }] });

    const { result } = renderHook(() => useEntryHistory(createOptions({ canUpdateEntries: false })), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.historyTimelineItems).toHaveLength(1));

    expect(result.current.restoreDisabledReason).toContain('permission');
  });

  it('restore is disabled when no diffs', async () => {
    getEntryHistoryMock.mockResolvedValue({ history: [{ hash: 'abc123', createdAt: '2024-01-02T00:00:00Z' }] });
    getEntryVersionMock.mockResolvedValue({ entry: selectedEntry });

    const { result } = renderHook(() => useEntryHistory(createOptions()), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.selectedHistoryVersionData).not.toBeNull());

    expect(result.current.restoreDisabledReason).toContain('no differing fields');
  });

  it('handles restore revision', async () => {
    const onRestoreRevision = vi.fn();
    getEntryHistoryMock.mockResolvedValue({ history: [{ hash: 'abc123', createdAt: '2024-01-02T00:00:00Z' }] });
    getEntryVersionMock.mockResolvedValue({ entry: { ...selectedEntry, title: 'Restored' } });

    const { result } = renderHook(() => useEntryHistory(createOptions({ onRestoreRevision })), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.selectedHistoryVersionData).not.toBeNull());
    expect(result.current.historyFieldDiffs.length).toBeGreaterThan(0);

    act(() => result.current.openRestoreConfirm());
    expect(result.current.restoreConfirmOpened).toBe(true);

    await act(async () => result.current.handleRestoreSelectedRevision());

    expect(onRestoreRevision).toHaveBeenCalled();
    expect(result.current.restorePending).toBe(false);
  });
});
