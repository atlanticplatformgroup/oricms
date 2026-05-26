import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CollectionConfig, ContentType } from '@ori/shared';
import { useCollectionBrowseModel } from '../useCollectionBrowseModel';

const listEntriesMock = vi.fn();

vi.mock('../../lib/api/collections', () => ({
  collectionsApi: {
    listEntries: (...args: unknown[]) => listEntriesMock(...args),
  },
}));

vi.mock('../useBrowseSearch', () => ({
  useBrowseSearch: () => ({
    value: '',
    setValue: vi.fn(),
    debouncedValue: '',
    hasActiveSearch: false,
    clear: vi.fn(),
  }),
}));

vi.mock('../../lib/entries/displayResolver', () => ({
  resolveBrowseRelationLabelsByField: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../lib/entries/resolution', () => ({
  getCollectionTableColumns: () => [{ key: '$id', label: 'Entry ID', fieldType: '$id' }],
}));

vi.mock('../../lib/fields/capabilities', () => ({
  resolveRegisteredFieldCapability: ({ value }: any) => ({
    displayText: String(value),
    sortToken: String(value),
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useCollectionBrowseModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const collection: CollectionConfig = { id: 'posts', label: 'Posts', contentType: 'post', path: 'posts' };
  const contentType: ContentType = { $schema: 'content-type-v1', $id: 'post', name: 'post', label: 'Post', labelPlural: 'Posts', plural: 'posts', fields: [], display: { primary: 'title' } };

  function createOptions(overrides: Partial<Parameters<typeof useCollectionBrowseModel>[0]> = {}) {
    return {
      projectId: 'project-1',
      branchName: 'main',
      activeSecondaryId: 'posts',
      selectedCollection: collection,
      selectedContentType: contentType,
      collections: [collection],
      contentTypes: [contentType],
      tableAssetMap: new Map(),
      ...overrides,
    };
  }

  it('returns empty state when no collection selected', () => {
    const { result } = renderHook(() => useCollectionBrowseModel(createOptions({ selectedCollection: null })), {
      wrapper: createWrapper(),
    });

    expect(result.current.entries).toEqual([]);
    expect(result.current.entriesLoading).toBe(false);
    expect(result.current.shownMetric).toBe('0 shown');
  });

  it('loads entries and pagination', async () => {
    listEntriesMock.mockResolvedValue({
      data: [
        { $id: 'entry-1', $type: 'post', $status: 'draft', $createdAt: '2024-01-01T00:00:00Z', $updatedAt: '2024-01-02T00:00:00Z' },
        { $id: 'entry-2', $type: 'post', $status: 'published', $createdAt: '2024-01-01T00:00:00Z', $updatedAt: '2024-01-03T00:00:00Z' },
      ],
      meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 2 } },
    });

    const { result } = renderHook(() => useCollectionBrowseModel(createOptions()), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.entries).toHaveLength(2));

    expect(result.current.entriesPagination.total).toBe(2);
    expect(result.current.entriesPagination.page).toBe(1);
    expect(result.current.shownMetric).toBe('1\u20132 of 2');
  });

  it('sorts entries by $updatedAt descending by default', async () => {
    listEntriesMock.mockResolvedValue({
      data: [
        { $id: 'entry-1', $type: 'post', $status: 'draft', $createdAt: '2024-01-01T00:00:00Z', $updatedAt: '2024-01-01T00:00:00Z' },
        { $id: 'entry-2', $type: 'post', $status: 'published', $createdAt: '2024-01-01T00:00:00Z', $updatedAt: '2024-01-03T00:00:00Z' },
      ],
      meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 2 } },
    });

    const { result } = renderHook(() => useCollectionBrowseModel(createOptions()), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.entries).toHaveLength(2));

    expect(result.current.entries[0].$id).toBe('entry-2');
    expect(result.current.entries[1].$id).toBe('entry-1');
  });

  it('toggles sort direction', async () => {
    listEntriesMock.mockResolvedValue({
      data: [
        { $id: 'a', $type: 'post', $status: 'draft', $createdAt: '2024-01-01T00:00:00Z', $updatedAt: '2024-01-01T00:00:00Z' },
        { $id: 'b', $type: 'post', $status: 'published', $createdAt: '2024-01-01T00:00:00Z', $updatedAt: '2024-01-03T00:00:00Z' },
      ],
      meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 2 } },
    });

    const { result } = renderHook(() => useCollectionBrowseModel(createOptions()), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.entries).toHaveLength(2));

    act(() => result.current.toggleSort('$updatedAt'));

    expect(result.current.sortState.direction).toBe('asc');
    expect(result.current.entries[0].$id).toBe('a');
  });

  it('computes emptyState for no entries', () => {
    listEntriesMock.mockResolvedValue({ data: [], meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 0 } } });

    const { result } = renderHook(() => useCollectionBrowseModel(createOptions()), {
      wrapper: createWrapper(),
    });

    expect(result.current.emptyState.title).toBe('No entries');
  });

  it('resets page when activeSecondaryId changes', async () => {
    listEntriesMock.mockResolvedValue({
      data: [{ $id: 'e1', $type: 'post', $status: 'draft', $createdAt: '', $updatedAt: '' }],
      meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 } },
    });

    const { result, rerender } = renderHook(
      ({ id }) => useCollectionBrowseModel(createOptions({ activeSecondaryId: id })),
      {
        wrapper: createWrapper(),
        initialProps: { id: 'posts' },
      },
    );

    await waitFor(() => expect(result.current.entryPage).toBe(1));

    act(() => result.current.setEntryPage(3));
    expect(result.current.entryPage).toBe(3);

    rerender({ id: 'pages' });

    expect(result.current.entryPage).toBe(1);
  });

  it('computes tableColumns', () => {
    const { result } = renderHook(() => useCollectionBrowseModel(createOptions()), {
      wrapper: createWrapper(),
    });

    expect(result.current.tableColumns).toEqual([{ key: '$id', label: 'Entry ID', fieldType: '$id' }]);
  });

  it('exposes retryEntries', async () => {
    listEntriesMock.mockResolvedValue({ data: [], meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 0 } } });

    const { result } = renderHook(() => useCollectionBrowseModel(createOptions()), {
      wrapper: createWrapper(),
    });

    act(() => result.current.retryEntries());

    expect(result.current.retryEntries).toBeInstanceOf(Function);
  });
});
