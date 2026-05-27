import { describe, expect, it } from 'vitest';
import {
  deriveCollectionEntryLabel,
  toContentRecordDetail,
  toContentRecordSummary,
} from '../content-resources';

describe('content resource helpers', () => {
  it('derives labels from the first descriptive content field', () => {
    expect(
      deriveCollectionEntryLabel({
        $id: 'entry-1',
        $type: 'article',
        title: 'Hello world',
        slug: 'hello-world',
      }),
    ).toBe('Hello world');

    expect(
      deriveCollectionEntryLabel({
        $id: 'entry-2',
        $type: 'article',
        slug: 'fallback-slug',
      }),
    ).toBe('fallback-slug');
  });

  it('maps content records into summary and detail payloads', () => {
    const collection = {
      id: 'posts',
      label: 'Posts',
      path: 'content/posts',
      contentType: 'article',
    } as const;
    const entry = {
      $id: 'entry-1',
      $type: 'article',
      $status: 'published',
      $createdAt: '2026-03-01T00:00:00.000Z',
      $updatedAt: '2026-03-02T00:00:00.000Z',
      title: 'Hello world',
    };

    expect(toContentRecordSummary(collection, entry)).toEqual({
      id: 'entry-1',
      label: 'Hello world',
      status: 'published',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-02T00:00:00.000Z',
      path: 'content/posts/entry-1.json',
    });

    expect(toContentRecordDetail(collection, entry, 'abc123')).toEqual({
      id: 'entry-1',
      label: 'Hello world',
      status: 'published',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-02T00:00:00.000Z',
      path: 'content/posts/entry-1.json',
      data: entry,
      meta: { revision: 'abc123' },
    });
  });
});
