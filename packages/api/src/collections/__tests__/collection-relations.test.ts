import { describe, it, expect, vi } from 'vitest';
import type { CollectionEntry, ContentType } from '@ori/shared';
import { populateCollectionRelations } from '../collection-relations';

function createMockContentType(fields: ContentType['fields']): ContentType {
  return {
    $schema: 'content-type-v1',
    id: 'test-type',
    label: 'Test Type',
    fields,
  };
}

function createMockEntry(overrides: Partial<CollectionEntry> = {}): CollectionEntry {
  return {
    $id: 'entry-1',
    $type: 'test-type',
    ...overrides,
  } as CollectionEntry;
}

describe('populateCollectionRelations', () => {
  it('should batch relation lookups via findManyById when available', async () => {
    const authorType: ContentType = createMockContentType([
      { key: 'name', type: 'text', label: 'Name' },
      { key: 'bestFriend', type: 'relation', label: 'Best Friend', relation: { target: 'author' } },
    ]);

    const relatedEntry1 = createMockEntry({ $id: 'author-1', $type: 'author', name: 'Alice' });
    const relatedEntry2 = createMockEntry({ $id: 'author-2', $type: 'author', name: 'Bob' });

    const findManyById = vi.fn().mockResolvedValue([relatedEntry1, relatedEntry2]);
    const findOne = vi.fn();

    const entries = [
      createMockEntry({ $id: 'post-1', bestFriend: 'author-1' }),
      createMockEntry({ $id: 'post-2', bestFriend: 'author-2' }),
    ];

    await populateCollectionRelations({
      entries,
      populate: 'bestFriend',
      getContentType: () => Promise.resolve(authorType),
      findOne,
      findManyById,
    });

    expect(findManyById).toHaveBeenCalledTimes(1);
    expect(findManyById).toHaveBeenCalledWith('author', ['author-1', 'author-2']);
    expect(findOne).not.toHaveBeenCalled();

    expect(entries[0].bestFriend).toEqual(relatedEntry1);
    expect(entries[1].bestFriend).toEqual(relatedEntry2);
  });

  it('should fall back to findOne when findManyById is not provided', async () => {
    const authorType: ContentType = createMockContentType([
      { key: 'name', type: 'text', label: 'Name' },
      { key: 'bestFriend', type: 'relation', label: 'Best Friend', relation: { target: 'author' } },
    ]);

    const relatedEntry = createMockEntry({ $id: 'author-1', $type: 'author', name: 'Alice' });
    const findOne = vi.fn().mockResolvedValue(relatedEntry);

    const entries = [createMockEntry({ $id: 'post-1', bestFriend: 'author-1' })];

    await populateCollectionRelations({
      entries,
      populate: 'bestFriend',
      getContentType: () => Promise.resolve(authorType),
      findOne,
    });

    expect(findOne).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledWith('author', 'author-1');
    expect(entries[0].bestFriend).toEqual(relatedEntry);
  });

  it('should handle entries across multiple target collections', async () => {
    const postType: ContentType = createMockContentType([
      { key: 'title', type: 'text', label: 'Title' },
      { key: 'author', type: 'relation', label: 'Author', relation: { target: 'author' } },
      { key: 'category', type: 'relation', label: 'Category', relation: { target: 'category' } },
    ]);

    const authorEntry = createMockEntry({ $id: 'author-1', $type: 'author', name: 'Alice' });
    const categoryEntry = createMockEntry({ $id: 'cat-1', $type: 'category', name: 'Tech' });

    const findManyById = vi.fn().mockImplementation((target: string, ids: string[]) => {
      if (target === 'author') return Promise.resolve([authorEntry]);
      if (target === 'category') return Promise.resolve([categoryEntry]);
      return Promise.resolve([]);
    });

    const entries = [
      createMockEntry({ $id: 'post-1', author: 'author-1', category: 'cat-1' }),
    ];

    await populateCollectionRelations({
      entries,
      populate: ['author', 'category'],
      getContentType: () => Promise.resolve(postType),
      findOne: vi.fn(),
      findManyById,
    });

    expect(findManyById).toHaveBeenCalledTimes(2);
    expect(findManyById).toHaveBeenCalledWith('author', ['author-1']);
    expect(findManyById).toHaveBeenCalledWith('category', ['cat-1']);

    expect(entries[0].author).toEqual(authorEntry);
    expect(entries[0].category).toEqual(categoryEntry);
  });

  it('should skip non-relation fields', async () => {
    const postType: ContentType = createMockContentType([
      { key: 'title', type: 'text', label: 'Title' },
      { key: 'author', type: 'relation', label: 'Author', relation: { target: 'author' } },
    ]);

    const findManyById = vi.fn().mockResolvedValue([]);

    const entries = [
      createMockEntry({ $id: 'post-1', title: 'Hello', author: 'author-1' }),
    ];

    await populateCollectionRelations({
      entries,
      populate: ['title', 'author'],
      getContentType: () => Promise.resolve(postType),
      findOne: vi.fn(),
      findManyById,
    });

    expect(findManyById).toHaveBeenCalledTimes(1);
    expect(findManyById).toHaveBeenCalledWith('author', ['author-1']);
    expect(entries[0].title).toBe('Hello');
  });

  it('should ignore missing related entries', async () => {
    const authorType: ContentType = createMockContentType([
      { key: 'name', type: 'text', label: 'Name' },
      { key: 'bestFriend', type: 'relation', label: 'Best Friend', relation: { target: 'author' } },
    ]);

    const findManyById = vi.fn().mockResolvedValue([]);

    const entries = [createMockEntry({ $id: 'post-1', bestFriend: 'missing-author' })];

    await populateCollectionRelations({
      entries,
      populate: 'bestFriend',
      getContentType: () => Promise.resolve(authorType),
      findOne: vi.fn(),
      findManyById,
    });

    expect(entries[0].bestFriend).toBe('missing-author');
  });
});
