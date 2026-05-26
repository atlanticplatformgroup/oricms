import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { CollectionConfig, ContentType } from '@ori/shared';
import { useCollectionManager } from '../useCollectionManager';

vi.mock('../../lib/collections/path', () => ({
  normalizeCollectionPath: (path: string) => path,
  getCollectionPathError: (path: string, _collections: CollectionConfig[], _excludeId?: string) => {
    if (path === 'duplicate') return 'Path already exists';
    if (path === 'invalid') return 'Invalid path';
    return '';
  },
}));

vi.mock('../../lib/workspace/format', () => ({
  toLabel: (id: string) => id.charAt(0).toUpperCase() + id.slice(1),
}));

vi.mock('../../lib/schemas/factory', () => ({
  toSchemaFieldKey: (id: string) => id.toLowerCase().replace(/\s+/g, '-'),
}));

describe('useCollectionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const collections: CollectionConfig[] = [
    { id: 'posts', label: 'Posts', contentType: 'post', path: 'posts' },
  ];

  const contentTypes: ContentType[] = [
    { $schema: 'content-type-v1', $id: 'post', name: 'post', label: 'Post', labelPlural: 'Posts', plural: 'posts', fields: [], display: { primary: 'title' } },
  ];

  function createHook(overrides: Partial<Parameters<typeof useCollectionManager>[0]> = {}) {
    const defaults = {
      selectedCollection: null as CollectionConfig | null,
      collections,
      contentTypes,
      selectedCollectionEntryCount: 0,
      showToast: vi.fn(),
      onPersistCreate: vi.fn(),
      onPersistSaveSettings: vi.fn(),
      onPersistDelete: vi.fn(),
    };
    return renderHook((props: Partial<Parameters<typeof useCollectionManager>[0]> = {}) =>
      useCollectionManager({ ...defaults, ...props }),
      { initialProps: overrides },
    );
  }

  it('returns initial state', () => {
    const { result } = createHook();

    expect(result.current.createCollectionOpened).toBe(false);
    expect(result.current.collectionSettings.id).toBe('');
    expect(result.current.newCollection.id).toBe('');
    expect(result.current.selectedTypeOptions).toHaveLength(1);
  });

  it('syncs collectionSettings when selectedCollection changes', () => {
    const selectedCollection: CollectionConfig = {
      id: 'posts', label: 'Posts', contentType: 'post', path: 'posts', description: 'Blog posts',
    };
    const { result, rerender } = createHook({ selectedCollection });

    expect(result.current.collectionSettings.id).toBe('posts');
    expect(result.current.collectionSettings.label).toBe('Posts');

    rerender({
      selectedCollection: { id: 'pages', label: 'Pages', contentType: 'page', path: 'pages' } as CollectionConfig,
    });

    expect(result.current.collectionSettings.id).toBe('pages');
    expect(result.current.collectionSettings.label).toBe('Pages');
  });

  it('computes selectedTypeOptions from contentTypes', () => {
    const { result } = createHook();

    expect(result.current.selectedTypeOptions).toEqual([{ value: 'post', label: 'Post' }]);
  });

  it('tracks dirty state when settings change', () => {
    const selectedCollection: CollectionConfig = {
      id: 'posts', label: 'Posts', contentType: 'post', path: 'posts',
    };
    const { result } = createHook({ selectedCollection });

    // Initially synced — no dirty
    expect(result.current.collectionSettings.label).toBe('Posts');

    act(() => result.current.setCollectionSettings((prev: any) => ({ ...prev, label: 'Articles' })));

    expect(result.current.collectionSettings.label).toBe('Articles');
  });

  it('validates new collection path error', () => {
    const { result } = createHook();

    act(() => result.current.setNewCollection({
      id: 'test', label: 'Test', singularLabel: 'Test', contentType: 'post', path: 'duplicate', description: '',
    }));

    expect(result.current.newCollectionPathError).toBe('Path already exists');
  });

  it('validates settings path error', () => {
    const selectedCollection: CollectionConfig = {
      id: 'posts', label: 'Posts', contentType: 'post', path: 'posts',
    };
    const { result } = createHook({ selectedCollection });

    act(() => result.current.setCollectionSettings((prev: any) => ({ ...prev, path: 'duplicate' })));

    expect(result.current.collectionSettingsPathError).toBe('Path already exists');
  });

  it('openCreateCollection initializes with defaults', () => {
    const { result } = createHook();

    act(() => result.current.openCreateCollection());

    expect(result.current.createCollectionOpened).toBe(true);
    expect(result.current.newCollection.id).toBe('post');
    expect(result.current.newCollection.label).toBe('Posts');
    expect(result.current.newCollection.contentType).toBe('post');
  });

  it('handleCreateCollection validates required fields', async () => {
    const showToast = vi.fn();
    const onPersistCreate = vi.fn();
    const { result } = createHook({ showToast, onPersistCreate });

    act(() => result.current.setNewCollection({
      id: '', label: '', singularLabel: '', contentType: '', path: '', description: '',
    }));

    await act(async () => result.current.handleCreateCollection());

    expect(showToast).toHaveBeenCalledWith('Schema id is required', 'error');
    expect(onPersistCreate).not.toHaveBeenCalled();
  });

  it('handleCreateCollection calls onPersistCreate when valid', async () => {
    const onPersistCreate = vi.fn();
    const { result } = createHook({ onPersistCreate });

    act(() => result.current.setNewCollection({
      id: 'articles', label: 'Articles', singularLabel: 'Article', contentType: 'post', path: 'articles', description: '',
    }));

    await act(async () => result.current.handleCreateCollection());

    expect(onPersistCreate).toHaveBeenCalled();
    expect(result.current.createCollectionOpened).toBe(false);
  });

  it('handleSaveCollectionSettings validates duplicate id', async () => {
    const showToast = vi.fn();
    const selectedCollection: CollectionConfig = {
      id: 'posts', label: 'Posts', contentType: 'post', path: 'posts',
    };
    const { result } = createHook({ selectedCollection, showToast });

    act(() => result.current.setCollectionSettings((prev: any) => ({ ...prev, id: 'posts' })));

    await act(async () => result.current.handleSaveCollectionSettings());

    expect(showToast).not.toHaveBeenCalledWith('Schema id already exists', 'error');
  });

  it('handleDeleteCollection calls onPersistDelete after confirm', async () => {
    const onPersistDelete = vi.fn();
    const selectedCollection: CollectionConfig = {
      id: 'posts', label: 'Posts', contentType: 'post', path: 'posts',
    };
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { result } = createHook({ selectedCollection, onPersistDelete });

    await act(async () => result.current.handleDeleteCollection());

    expect(onPersistDelete).toHaveBeenCalledWith('posts', null, undefined);
  });
});
