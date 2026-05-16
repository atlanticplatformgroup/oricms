import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CollectionConfig, ContentType } from '@ori/shared';
import { useCollectionManager } from '../hooks/useCollectionManager';

const contentTypes: ContentType[] = [
  {
    $schema: 'content-type-v1',
    $id: 'post',
    name: 'post',
    plural: 'posts',
    label: 'Post',
    labelPlural: 'Posts',
    fields: [],
    display: { primary: 'title' },
  },
];

const baseCollection: CollectionConfig = {
  id: 'posts',
  label: 'Posts',
  singularLabel: 'Post',
  contentType: 'post',
  path: 'content/posts',
  description: 'Initial description',
};

function renderCollectionManager(selectedCollection: CollectionConfig | null) {
  return renderHook(
    ({ collection }) =>
      useCollectionManager({
        selectedCollection: collection,
        collections: collection ? [collection] : [],
        contentTypes,
        selectedCollectionEntryCount: 0,
        showToast: vi.fn(),
        onPersistCreate: vi.fn(),
        onPersistSaveSettings: vi.fn(),
        onPersistDelete: vi.fn(),
      }),
    {
      initialProps: { collection: selectedCollection },
    },
  );
}

describe('useCollectionManager', () => {
  it('preserves unsaved collection settings when the same collection refreshes', () => {
    const refreshedCollection: CollectionConfig = {
      ...baseCollection,
      label: 'Posts from server',
    };
    const { result, rerender } = renderCollectionManager(baseCollection);

    act(() => {
      result.current.setCollectionSettings((previous) => ({
        ...previous,
        path: 'content/edited-posts',
      }));
    });

    rerender({ collection: refreshedCollection });

    expect(result.current.collectionSettings.path).toBe('content/edited-posts');
    expect(result.current.collectionSettings.label).toBe('Posts');
  });

  it('syncs refreshed collection settings when there are no local edits', () => {
    const refreshedCollection: CollectionConfig = {
      ...baseCollection,
      description: 'Updated from server',
    };
    const { result, rerender } = renderCollectionManager(baseCollection);

    rerender({ collection: refreshedCollection });

    expect(result.current.collectionSettings.description).toBe('Updated from server');
  });
});
