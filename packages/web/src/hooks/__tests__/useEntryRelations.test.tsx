import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { CollectionConfig, CollectionEntry, ContentType, SchemaField } from '@ori/shared';
import { useEntryRelations } from '../useEntryRelations';
import { collectionsApi } from '../../lib/api/collections';

vi.mock('../../lib/api/collections', () => ({
  collectionsApi: {
    listEntries: vi.fn(),
  },
}));

describe('useEntryRelations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const collections: CollectionConfig[] = [
    { id: 'posts', label: 'Posts', contentType: 'post', path: 'posts' },
    { id: 'authors', label: 'Authors', contentType: 'author', path: 'authors' },
  ];

  const contentTypes: ContentType[] = [];

  function createField(type: 'relation' | 'reference' | 'text', key: string, options?: { targetCollection?: string; multiple?: boolean }): SchemaField {
    const field = {
      key,
      type,
      label: key,
    } as SchemaField & Record<string, unknown>;
    if (options?.targetCollection) {
      (field as any).relation = { target: options.targetCollection, type: 'manyToOne' };
    }
    if (options?.multiple) {
      (field as any).multiple = true;
    }
    return field;
  }

  it('returns empty state when no relation fields', () => {
    const visibleEditorFields = [createField('text', 'title')];
    const { result } = renderHook(() =>
      useEntryRelations({
        projectId: 'project-1',
        visibleEditorFields,
        collections,
        contentTypes,
        draftEntry: null,
      }),
    );

    expect(result.current.relationOptionsByField).toEqual({});
    expect(result.current.activeRelationField).toBeNull();
  });

  it('loads relation options for relation fields', async () => {
    vi.mocked(collectionsApi.listEntries).mockResolvedValue({
      data: [
        { $id: 'entry-1', $type: 'author', name: 'Alice' },
        { $id: 'entry-2', $type: 'author', name: 'Bob' },
      ],
    } as any);

    const visibleEditorFields = [createField('relation', 'author', { targetCollection: 'authors' })];
    const { result } = renderHook(() =>
      useEntryRelations({
        projectId: 'project-1',
        visibleEditorFields,
        collections,
        contentTypes,
        draftEntry: null,
      }),
    );

    await waitFor(() => expect(Object.keys(result.current.relationOptionsByField)).toHaveLength(1));

    expect(result.current.relationOptionsByField.author).toHaveLength(2);
    expect(result.current.relationOptionsByField.author[0]).toEqual(expect.objectContaining({ value: 'entry-1' }));
  });

  it('includes selected ids not in fetched results', async () => {
    vi.mocked(collectionsApi.listEntries).mockResolvedValue({ data: [] } as any);

    const visibleEditorFields = [createField('relation', 'author', { targetCollection: 'authors' })];
    const draftEntry = { $id: 'post-1', $type: 'post', $status: 'draft', $createdAt: '', $updatedAt: '', author: 'author-99' } as unknown as CollectionEntry;

    const { result } = renderHook(() =>
      useEntryRelations({
        projectId: 'project-1',
        visibleEditorFields,
        collections,
        contentTypes,
        draftEntry,
      }),
    );

    await waitFor(() => expect(Object.keys(result.current.relationOptionsByField)).toHaveLength(1));

    expect(result.current.relationOptionsByField.author[0]).toEqual({ value: 'author-99', label: 'author-99' });
  });

  it('opens relation picker and sets active field', () => {
    const visibleEditorFields = [createField('relation', 'author', { targetCollection: 'authors' })];
    const { result } = renderHook(() =>
      useEntryRelations({
        projectId: 'project-1',
        visibleEditorFields,
        collections,
        contentTypes,
        draftEntry: null,
      }),
    );

    act(() => result.current.openRelationPicker('author'));

    expect(result.current.relationPickerOpened).toBe(true);
    expect(result.current.activeRelationFieldKey).toBe('author');
    expect(result.current.relationSearch).toBe('');
  });

  it('computes active selected relation ids for single relation', async () => {
    vi.mocked(collectionsApi.listEntries).mockResolvedValue({
      data: [{ $id: 'author-1', $type: 'author', name: 'Alice' }],
    } as any);

    const visibleEditorFields = [createField('relation', 'author', { targetCollection: 'authors' })];
    const draftEntry = { $id: 'post-1', $type: 'post', $status: 'draft', $createdAt: '', $updatedAt: '', author: 'author-1' } as unknown as CollectionEntry;

    const { result } = renderHook(() =>
      useEntryRelations({
        projectId: 'project-1',
        visibleEditorFields,
        collections,
        contentTypes,
        draftEntry,
      }),
    );

    act(() => result.current.openRelationPicker('author'));

    expect(result.current.activeSelectedRelationIds).toHaveLength(1);

    expect(result.current.activeSelectedRelationIds).toEqual(['author-1']);
    expect(result.current.activeRelationMultiple).toBe(false);
  });

  it('computes active selected relation ids for multi relation', async () => {
    vi.mocked(collectionsApi.listEntries).mockResolvedValue({
      data: [{ $id: 'tag-1', $type: 'tag', name: 'Red' }],
    } as any);

    const extendedCollections = [...collections, { id: 'tags', label: 'Tags', contentType: 'tag', path: 'tags' }];
    const visibleEditorFields = [createField('relation', 'tags', { targetCollection: 'tags', multiple: true })];
    const draftEntry = { $id: 'post-1', $type: 'post', $status: 'draft', $createdAt: '', $updatedAt: '', tags: ['tag-1', 'tag-2'] } as unknown as CollectionEntry;

    const { result } = renderHook(() =>
      useEntryRelations({
        projectId: 'project-1',
        visibleEditorFields,
        collections: extendedCollections,
        contentTypes,
        draftEntry,
      }),
    );

    act(() => result.current.openRelationPicker('tags'));

    await waitFor(() => expect(result.current.activeSelectedRelationIds).toHaveLength(2));

    expect(result.current.activeSelectedRelationIds).toEqual(['tag-1', 'tag-2']);
    expect(result.current.activeRelationMultiple).toBe(true);
  });

  it('loads picker results when opened', async () => {
    vi.mocked(collectionsApi.listEntries).mockResolvedValue({
      data: [
        { $id: 'author-1', $type: 'author', name: 'Alice' },
        { $id: 'author-2', $type: 'author', name: 'Bob' },
      ],
    } as any);

    const visibleEditorFields = [createField('relation', 'author', { targetCollection: 'authors' })];
    const { result } = renderHook(() =>
      useEntryRelations({
        projectId: 'project-1',
        visibleEditorFields,
        collections,
        contentTypes,
        draftEntry: null,
      }),
    );

    act(() => result.current.openRelationPicker('author'));

    await waitFor(() => expect(result.current.relationPickerResults).toHaveLength(2));
    expect(result.current.relationPickerLoading).toBe(false);
  });

  it('clears relation options when projectId is null', () => {
    const visibleEditorFields = [createField('relation', 'author', { targetCollection: 'authors' })];
    const { result } = renderHook(() =>
      useEntryRelations({
        projectId: null,
        visibleEditorFields,
        collections,
        contentTypes,
        draftEntry: null,
      }),
    );

    expect(result.current.relationOptionsByField).toEqual({});
  });
});
