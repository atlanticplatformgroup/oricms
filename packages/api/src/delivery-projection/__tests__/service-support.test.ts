import { describe, expect, it } from 'vitest';
import type { CollectionEntry } from '@ori/shared';
import {
  applyProjectedEntryFilters,
  applyProjectedEntrySort,
  buildProjectedRecordInput,
  isProjectedEntryPublished,
  paginateProjectedEntries,
} from '../service-support';

function createEntry(overrides: Partial<CollectionEntry> = {}): CollectionEntry {
  return {
    $id: 'entry-1',
    $type: 'post',
    $status: 'published',
    $publishedAt: '2026-01-01T00:00:00.000Z',
    title: 'Hello World',
    rating: 5,
    category: 'news',
    ...overrides,
  };
}

describe('delivery projection service support', () => {
  it('treats scheduled or unpublished entries as not published', () => {
    expect(isProjectedEntryPublished(createEntry(), '2026-01-02T00:00:00.000Z')).toBe(true);
    expect(
      isProjectedEntryPublished(
        createEntry({ $publishedAt: '2026-02-01T00:00:00.000Z' }),
        '2026-01-02T00:00:00.000Z',
      ),
    ).toBe(false);
    expect(
      isProjectedEntryPublished(
        createEntry({ $status: 'draft' }),
        '2026-01-02T00:00:00.000Z',
      ),
    ).toBe(false);
  });

  it('applies projection filters with comparison operators', () => {
    const entries = [
      createEntry({ $id: 'entry-1', rating: 1, category: 'news' }),
      createEntry({ $id: 'entry-2', rating: 3, category: 'docs' }),
      createEntry({ $id: 'entry-3', rating: 5, category: 'news' }),
    ];

    const filtered = applyProjectedEntryFilters(entries, {
      rating_gte: 3,
      category: 'news',
    });

    expect(filtered.map((entry) => entry.$id)).toEqual(['entry-3']);
  });

  it('sorts projected entries with nullish values last', () => {
    const entries = [
      createEntry({ $id: 'entry-1', title: 'Beta' }),
      createEntry({ $id: 'entry-2', title: null as unknown as string }),
      createEntry({ $id: 'entry-3', title: 'Alpha' }),
    ];

    const sorted = applyProjectedEntrySort(entries, { title: 'asc' });
    expect(sorted.map((entry) => entry.$id)).toEqual(['entry-3', 'entry-1', 'entry-2']);
  });

  it('paginates projected entries', () => {
    const entries = [
      createEntry({ $id: 'entry-1' }),
      createEntry({ $id: 'entry-2' }),
      createEntry({ $id: 'entry-3' }),
    ];

    const result = paginateProjectedEntries(entries, 2, 1);

    expect(result.data.map((entry) => entry.$id)).toEqual(['entry-2']);
    expect(result.meta.pagination).toEqual({
      page: 2,
      pageSize: 1,
      pageCount: 3,
      total: 3,
    });
  });

  it('builds projected record input from entry metadata', () => {
    const projectedAt = new Date('2026-01-03T00:00:00.000Z');
    const entry = createEntry({
      $id: 'entry-42',
      slug: 'hello-world',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });

    const record = buildProjectedRecordInput({
      projectId: 'project-1',
      branch: 'main',
      collectionId: 'posts',
      contentType: 'post',
      entry,
      projectedAt,
    });

    expect(record).toMatchObject({
      projectId: 'project-1',
      branch: 'main',
      collectionId: 'posts',
      entryId: 'entry-42',
      contentType: 'post',
      slug: 'hello-world',
      publishedAt: '2026-01-01T00:00:00.000Z',
      updatedAtSource: '2026-01-02T00:00:00.000Z',
      projectedAt,
    });
  });
});
