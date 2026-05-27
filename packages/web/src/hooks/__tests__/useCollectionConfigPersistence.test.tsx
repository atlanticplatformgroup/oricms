import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CollectionConfig } from '@ori/shared';
import { useCollectionConfigPersistence } from '../useCollectionConfigPersistence';

const updateConfigMock = vi.fn();
const deleteCollectionMock = vi.fn();

vi.mock('../../lib/api/collections', () => ({
  collectionsApi: {
    updateConfig: (...args: unknown[]) => updateConfigMock(...args),
    deleteCollection: (...args: unknown[]) => deleteCollectionMock(...args),
  },
}));

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

describe('useCollectionConfigPersistence', () => {
  it('returns mutation objects', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useCollectionConfigPersistence({
          projectId: 'proj-1',
          activeProjectSlug: 'proj',
          activeBranchName: 'main',
          activeSection: 'collections',
          showToast: vi.fn(),
          queryClient: new QueryClient(),
          navigate: vi.fn(),
        }),
      { wrapper: Wrapper },
    );

    expect(result.current.updateCollectionsConfigMutation).toBeDefined();
    expect(result.current.deleteCollectionMutation).toBeDefined();
  });

  it('calls updateConfig on save mutation', async () => {
    updateConfigMock.mockResolvedValue(undefined);
    const showToast = vi.fn();
    const navigate = vi.fn();
    const { Wrapper, queryClient } = createWrapper();

    const { result } = renderHook(
      () =>
        useCollectionConfigPersistence({
          projectId: 'proj-1',
          activeProjectSlug: 'proj',
          activeBranchName: 'main',
          activeSection: 'collections',
          showToast,
          queryClient,
          navigate,
        }),
      { wrapper: Wrapper },
    );

    const collections: CollectionConfig[] = [{ id: 'posts', label: 'Posts', contentType: 'post', path: 'content/posts' }];

    await result.current.updateCollectionsConfigMutation.mutateAsync({
      nextCollections: collections,
      nextCollectionId: 'posts',
      action: 'save',
    });

    expect(updateConfigMock).toHaveBeenCalledWith('proj-1', collections, undefined);
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Schema settings saved', 'success');
    });
  });

  it('calls deleteCollection on delete mutation', async () => {
    deleteCollectionMock.mockResolvedValue(undefined);
    const showToast = vi.fn();
    const navigate = vi.fn();
    const { Wrapper, queryClient } = createWrapper();

    const { result } = renderHook(
      () =>
        useCollectionConfigPersistence({
          projectId: 'proj-1',
          activeProjectSlug: 'proj',
          activeBranchName: 'main',
          activeSection: 'collections',
          showToast,
          queryClient,
          navigate,
        }),
      { wrapper: Wrapper },
    );

    await result.current.deleteCollectionMutation.mutateAsync({
      collectionId: 'posts',
      nextCollectionId: null,
    });

    expect(deleteCollectionMock).toHaveBeenCalledWith('proj-1', 'posts', undefined);
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Schema deleted', 'success');
    });
  });

  it('shows error toast on update failure', async () => {
    updateConfigMock.mockRejectedValue(new Error('Network error'));
    const showToast = vi.fn();
    const { Wrapper, queryClient } = createWrapper();

    const { result } = renderHook(
      () =>
        useCollectionConfigPersistence({
          projectId: 'proj-1',
          activeProjectSlug: 'proj',
          activeBranchName: 'main',
          activeSection: 'collections',
          showToast,
          queryClient,
          navigate: vi.fn(),
        }),
      { wrapper: Wrapper },
    );

    await expect(
      result.current.updateCollectionsConfigMutation.mutateAsync({
        nextCollections: [],
        action: 'save',
      }),
    ).rejects.toBeDefined();

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Failed to update schema settings', 'error');
    });
  });

  it('shows error toast on delete failure', async () => {
    deleteCollectionMock.mockRejectedValue(new Error('Network error'));
    const showToast = vi.fn();
    const { Wrapper, queryClient } = createWrapper();

    const { result } = renderHook(
      () =>
        useCollectionConfigPersistence({
          projectId: 'proj-1',
          activeProjectSlug: 'proj',
          activeBranchName: 'main',
          activeSection: 'collections',
          showToast,
          queryClient,
          navigate: vi.fn(),
        }),
      { wrapper: Wrapper },
    );

    await expect(
      result.current.deleteCollectionMutation.mutateAsync({
        collectionId: 'posts',
      }),
    ).rejects.toBeDefined();

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Failed to delete collection', 'error');
    });
  });
});
