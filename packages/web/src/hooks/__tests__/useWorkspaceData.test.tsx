import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Asset, CollectionConfig } from '@ori/shared';
import { useWorkspaceData } from '../useWorkspaceData';

const listCollectionsMock = vi.fn();
const listContentTypesMock = vi.fn();
const getTypeSchemasMock = vi.fn();
const getComponentSchemasMock = vi.fn();
const getSchemaMock = vi.fn();
const listAssetsMock = vi.fn();
const listGlobalAssetsMock = vi.fn();
const getCatalogMock = vi.fn();
const getEntryMock = vi.fn();

vi.mock('../../lib/api/collections', () => ({
  collectionsApi: {
    list: (...args: unknown[]) => listCollectionsMock(...args),
    getEntry: (...args: unknown[]) => getEntryMock(...args),
  },
  contentTypesApi: {
    list: (...args: unknown[]) => listContentTypesMock(...args),
  },
}));

vi.mock('../../lib/api/git', () => ({
  gitApi: {
    getTypeSchemas: (...args: unknown[]) => getTypeSchemasMock(...args),
    getComponentSchemas: (...args: unknown[]) => getComponentSchemasMock(...args),
    getSchema: (...args: unknown[]) => getSchemaMock(...args),
  },
}));

vi.mock('../../lib/api/assets', () => ({
  assetsApi: {
    list: (...args: unknown[]) => listAssetsMock(...args),
  },
  globalAssetsApi: {
    list: (...args: unknown[]) => listGlobalAssetsMock(...args),
  },
}));

vi.mock('../../lib/api/workspace', () => ({
  workspaceApi: {
    getCatalog: (...args: unknown[]) => getCatalogMock(...args),
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

describe('useWorkspaceData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCollectionsMock.mockResolvedValue({ collections: [] });
    listContentTypesMock.mockResolvedValue({ contentTypes: [] });
    getTypeSchemasMock.mockResolvedValue({ schemas: [] });
    getComponentSchemasMock.mockResolvedValue({ schemas: [] });
    listAssetsMock.mockResolvedValue({ assets: [] });
    listGlobalAssetsMock.mockResolvedValue({ assets: [] });
    getCatalogMock.mockResolvedValue({ catalog: null });
    getEntryMock.mockResolvedValue({ entry: null });
    getSchemaMock.mockResolvedValue({ content: '{}' });
  });

  function createOptions(overrides: Partial<Parameters<typeof useWorkspaceData>[0]> = {}) {
    return {
      projectId: 'project-1',
      activeSection: 'collections' as const,
      activeSecondaryId: null,
      activeSchemaMode: 'types' as const,
      activeEntryId: null,
      branchName: 'main',
      canManageGlobalMedia: false,
      ...overrides,
    };
  }

  it('returns loading state when projectId is null', () => {
    const { result } = renderHook(() => useWorkspaceData(createOptions({ projectId: null })), {
      wrapper: createWrapper(),
    });

    expect(result.current.collections).toEqual([]);
    expect(result.current.contentTypes).toEqual([]);
    expect(result.current.selectedCollection).toBeNull();
  });

  it('loads collections and contentTypes', async () => {
    const collections: CollectionConfig[] = [{ id: 'posts', label: 'Posts', contentType: 'post', path: 'posts' }];
    listCollectionsMock.mockResolvedValue({ collections });

    const { result } = renderHook(() => useWorkspaceData(createOptions()), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.collections).toHaveLength(1));

    expect(result.current.collections[0].id).toBe('posts');
  });

  it('computes secondaryOptions for collections section', async () => {
    const collections: CollectionConfig[] = [
      { id: 'posts', label: 'Posts', contentType: 'post', path: 'posts' },
      { id: 'pages', label: 'Pages', contentType: 'page', path: 'pages' },
    ];
    listCollectionsMock.mockResolvedValue({ collections });

    const { result } = renderHook(() => useWorkspaceData(createOptions({ activeSection: 'collections' })), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.secondaryOptions).toHaveLength(2));

    expect(result.current.secondaryOptions[0].id).toBe('posts');
    expect(result.current.secondaryOptions[1].id).toBe('pages');
  });

  it('computes schemaSecondaryOptions for types mode', async () => {
    const schema = { $schema: 'content-type-v1', $id: 'post', name: 'post', label: 'Post', plural: 'posts', fields: [], display: { primary: 'title' } };
    getTypeSchemasMock.mockResolvedValue({ schemas: [{ path: 'schemas/types/post.json' }] });
    getSchemaMock.mockResolvedValue({ content: JSON.stringify(schema) });

    const { result } = renderHook(() => useWorkspaceData(createOptions({ activeSection: 'schemas', activeSchemaMode: 'types' })), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.schemaSecondaryOptions.some((o: any) => o.id === 'post')).toBe(true));

    expect(result.current.schemaSecondaryOptions[0].id).toBe('post');
  });

  it('computes schemaSecondaryOptions for components mode', async () => {
    const schema = { $schema: 'component-v1', $id: 'hero', name: 'hero', label: 'Hero', fields: [] };
    getComponentSchemasMock.mockResolvedValue({ schemas: [{ path: 'schemas/components/hero.json' }] });
    getSchemaMock.mockResolvedValue({ content: JSON.stringify(schema) });

    const { result } = renderHook(() => useWorkspaceData(createOptions({ activeSection: 'schemas', activeSchemaMode: 'components' })), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.schemaSecondaryOptions.some((o: any) => o.id === 'hero')).toBe(true));

    expect(result.current.schemaSecondaryOptions[0].id).toBe('hero');
  });

  it('computes selectedCollection and selectedContentType', async () => {
    const collections: CollectionConfig[] = [{ id: 'posts', label: 'Posts', contentType: 'post', path: 'posts' }];
    listCollectionsMock.mockResolvedValue({ collections });

    const { result } = renderHook(() => useWorkspaceData(createOptions({ activeSecondaryId: 'posts' })), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.selectedCollection).not.toBeNull());

    expect(result.current.selectedCollection?.id).toBe('posts');
  });

  it('computes assetOptions and assetMap', async () => {
    const assets: Asset[] = [
      { path: '/image1.jpg', url: 'http://localhost/img1.jpg', name: 'image1.jpg', folder: '/', size: 100, type: 'image', lastModified: '' } as unknown as Asset,
    ];
    listAssetsMock.mockResolvedValue({ assets });

    const { result } = renderHook(() => useWorkspaceData(createOptions()), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.assetOptions).toHaveLength(1));

    expect(result.current.assetOptions[0].value).toBe('/image1.jpg');
    expect(result.current.assetMap.has('/image1.jpg')).toBe(true);
  });

  it('computes tableAssetMap', async () => {
    const assets: Asset[] = [
      { path: '/doc1.pdf', url: 'http://localhost/doc1.pdf', name: 'doc1.pdf', folder: '/', size: 200, type: 'document', lastModified: '' } as unknown as Asset,
    ];
    listAssetsMock.mockResolvedValue({ assets });

    const { result } = renderHook(() => useWorkspaceData(createOptions()), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.tableAssetMap.has('/doc1.pdf')).toBe(true));
  });

  it('loads selectedEntry when entryId provided', async () => {
    const collections: CollectionConfig[] = [{ id: 'posts', label: 'Posts', contentType: 'post', path: 'posts' }];
    listCollectionsMock.mockResolvedValue({ collections });
    getEntryMock.mockResolvedValue({
      entry: { $id: 'entry-1', $type: 'post', $status: 'draft', $createdAt: '', $updatedAt: '', title: 'Hello' },
      meta: { revision: 'abc123' },
    });

    const { result } = renderHook(() => useWorkspaceData(createOptions({ activeSecondaryId: 'posts', activeEntryId: 'entry-1' })), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.selectedEntry).not.toBeNull());

    expect(result.current.selectedEntry?.$id).toBe('entry-1');
    expect(result.current.selectedEntryRevision).toBe('abc123');
  });

  it('computes secondaryOptions for settings with global media', async () => {
    const { result } = renderHook(() => useWorkspaceData(createOptions({ activeSection: 'settings', canManageGlobalMedia: true })), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.secondaryOptions.some((o: any) => o.id === 'global-media')).toBe(true));
  });

  it('computes componentSchemaMap', async () => {
    const schema = { $schema: 'component-v1', $id: 'hero', name: 'hero', label: 'Hero', fields: [] };
    getComponentSchemasMock.mockResolvedValue({ schemas: [{ path: 'schemas/components/hero.json' }] });
    getSchemaMock.mockResolvedValue({ content: JSON.stringify(schema) });

    const { result } = renderHook(() => useWorkspaceData(createOptions()), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.componentSchemaMap.has('hero')).toBe(true));
  });
});
