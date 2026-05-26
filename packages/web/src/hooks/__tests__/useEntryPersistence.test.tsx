import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CollectionConfig, CollectionEntry } from '@ori/shared';
import { useEntryPersistence } from '../useEntryPersistence';

const updateEntryMock = vi.fn();
const createEntryMock = vi.fn();
const deleteEntryMock = vi.fn();

vi.mock('../../lib/api/collections', () => ({
  collectionsApi: {
    updateEntry: (...args: unknown[]) => updateEntryMock(...args),
    createEntry: (...args: unknown[]) => createEntryMock(...args),
    deleteEntry: (...args: unknown[]) => deleteEntryMock(...args),
  },
}));

beforeEach(() => {
  updateEntryMock.mockClear();
  createEntryMock.mockClear();
  deleteEntryMock.mockClear();
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return { Wrapper, queryClient };
}

function createEntry(overrides: Record<string, unknown> = {}): CollectionEntry {
  return {
    $id: 'entry-1',
    $type: 'post',
    $status: 'draft',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  } as CollectionEntry;
}

const selectedCollection: CollectionConfig = {
  id: 'posts',
  label: 'Posts',
  singularLabel: 'Post',
  contentType: 'post',
  path: 'content/posts',
};

describe('useEntryPersistence', () => {
  it('returns mutation objects and handlers', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useEntryPersistence({
          canCreateEntries: true,
          canDeleteEntries: true,
          canUpdateEntries: true,
          commitMessage: '',
          currentRevision: 'rev-1',
          draftEntry: createEntry(),
          editorValidationCount: 0,
          entries: [],
          isDirty: true,
          onNavigateToCollection: vi.fn(),
          onNavigateToEntry: vi.fn(),
          primaryField: 'title',
          projectId: 'proj-1',
          queryClient: new QueryClient(),
          selectedCollection,
          selectedEntry: createEntry(),
          setBaselineEntry: vi.fn(),
          setCommitMessage: vi.fn(),
          setCurrentRevision: vi.fn(),
          setDraftEntry: vi.fn(),
          setShowCommitBar: vi.fn(),
          showToast: vi.fn(),
        }),
      { wrapper: Wrapper },
    );

    expect(result.current.updateEntryMutation).toBeDefined();
    expect(result.current.createEntryMutation).toBeDefined();
    expect(result.current.deleteEntryMutation).toBeDefined();
    expect(result.current.handleSaveEntry).toBeDefined();
    expect(result.current.handleCommitEntry).toBeDefined();
    expect(result.current.handleNewEntry).toBeDefined();
    expect(result.current.handleDeleteEntry).toBeDefined();
    expect(result.current.handleRestoreVersion).toBeDefined();
  });

  it('commits entry via update mutation', async () => {
    updateEntryMock.mockResolvedValue({ entry: createEntry(), meta: { revision: 'rev-2' } });
    const showToast = vi.fn();
    const setBaselineEntry = vi.fn();
    const setDraftEntry = vi.fn();
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useEntryPersistence({
          canCreateEntries: true,
          canDeleteEntries: true,
          canUpdateEntries: true,
          commitMessage: 'Update post',
          currentRevision: 'rev-1',
          draftEntry: createEntry({ title: 'Updated' }),
          editorValidationCount: 0,
          entries: [],
          isDirty: true,
          onNavigateToCollection: vi.fn(),
          onNavigateToEntry: vi.fn(),
          primaryField: 'title',
          projectId: 'proj-1',
          queryClient: new QueryClient(),
          selectedCollection,
          selectedEntry: createEntry(),
          setBaselineEntry,
          setCommitMessage: vi.fn(),
          setCurrentRevision: vi.fn(),
          setDraftEntry,
          setShowCommitBar: vi.fn(),
          showToast,
        }),
      { wrapper: Wrapper },
    );

    await result.current.handleCommitEntry();

    expect(updateEntryMock).toHaveBeenCalled();
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Entry saved', 'success');
    });
  });

  it('shows validation error before commit', () => {
    const showToast = vi.fn();
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useEntryPersistence({
          canCreateEntries: true,
          canDeleteEntries: true,
          canUpdateEntries: true,
          commitMessage: '',
          currentRevision: 'rev-1',
          draftEntry: createEntry(),
          editorValidationCount: 3,
          entries: [],
          isDirty: true,
          onNavigateToCollection: vi.fn(),
          onNavigateToEntry: vi.fn(),
          primaryField: 'title',
          projectId: 'proj-1',
          queryClient: new QueryClient(),
          selectedCollection,
          selectedEntry: createEntry(),
          setBaselineEntry: vi.fn(),
          setCommitMessage: vi.fn(),
          setCurrentRevision: vi.fn(),
          setDraftEntry: vi.fn(),
          setShowCommitBar: vi.fn(),
          showToast,
        }),
      { wrapper: Wrapper },
    );

    result.current.handleSaveEntry();
    expect(showToast).toHaveBeenCalledWith('Resolve 3 validation issues before saving', 'error');
  });

  it('creates new entry', async () => {
    createEntryMock.mockResolvedValue({ entry: createEntry({ $id: 'entry-2' }) });
    const showToast = vi.fn();
    const onNavigateToEntry = vi.fn();
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useEntryPersistence({
          canCreateEntries: true,
          canDeleteEntries: true,
          canUpdateEntries: true,
          commitMessage: '',
          currentRevision: null,
          draftEntry: null,
          editorValidationCount: 0,
          entries: [],
          isDirty: false,
          onNavigateToCollection: vi.fn(),
          onNavigateToEntry,
          primaryField: 'title',
          projectId: 'proj-1',
          queryClient: new QueryClient(),
          selectedCollection,
          selectedEntry: null,
          setBaselineEntry: vi.fn(),
          setCommitMessage: vi.fn(),
          setCurrentRevision: vi.fn(),
          setDraftEntry: vi.fn(),
          setShowCommitBar: vi.fn(),
          showToast,
        }),
      { wrapper: Wrapper },
    );

    await result.current.handleNewEntry();

    expect(createEntryMock).toHaveBeenCalled();
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Entry created', 'success');
      expect(onNavigateToEntry).toHaveBeenCalledWith('entry-2');
    });
  });

  it('does not create entry without permission', async () => {
    const showToast = vi.fn();
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useEntryPersistence({
          canCreateEntries: false,
          canDeleteEntries: true,
          canUpdateEntries: true,
          commitMessage: '',
          currentRevision: null,
          draftEntry: null,
          editorValidationCount: 0,
          entries: [],
          isDirty: false,
          onNavigateToCollection: vi.fn(),
          onNavigateToEntry: vi.fn(),
          primaryField: 'title',
          projectId: 'proj-1',
          queryClient: new QueryClient(),
          selectedCollection,
          selectedEntry: null,
          setBaselineEntry: vi.fn(),
          setCommitMessage: vi.fn(),
          setCurrentRevision: vi.fn(),
          setDraftEntry: vi.fn(),
          setShowCommitBar: vi.fn(),
          showToast,
        }),
      { wrapper: Wrapper },
    );

    await result.current.handleNewEntry();
    expect(createEntryMock).not.toHaveBeenCalled();
  });
});
