import { describe, expect, it } from 'vitest';
import type { CollectionEntry, ContentType } from '@ori/shared';
import { getCollectionBrowseSearchFields, matchesCollectionBrowseSearch } from '../search';

describe('collection browse search', () => {
  it('uses the schema-derived browse fields instead of deep-scanning every value', () => {
    const contentType: ContentType = {
      $schema: 'content-type-v1',
      $id: 'article',
      name: 'article',
      plural: 'articles',
      label: 'Article',
      labelPlural: 'Articles',
      fields: [
        { key: 'title', label: 'Title', type: 'string' },
        { key: 'subtitle', label: 'Subtitle', type: 'string' },
        { key: 'author', label: 'Author', type: 'string' },
        { key: 'internalNotes', label: 'Internal notes', type: 'text' },
      ],
      display: { primary: 'title', secondary: 'subtitle' },
    };

    expect(getCollectionBrowseSearchFields(contentType).map((field) => field.key)).toEqual(['title', 'subtitle', 'author']);

    const entry: CollectionEntry = {
      $id: 'article-1',
      $type: 'article',
      $status: 'draft',
      $createdAt: '2026-01-01T00:00:00.000Z',
      $updatedAt: '2026-01-01T00:00:00.000Z',
      title: 'Release notes',
      subtitle: 'March refresh',
      author: 'Core team',
      internalNotes: 'Secret launch checklist',
    };

    expect(matchesCollectionBrowseSearch(entry, 'release', contentType)).toBe(true);
    expect(matchesCollectionBrowseSearch(entry, 'secret', contentType)).toBe(false);
  });

  it('matches enum/select labels and relation labels from visible browse fields', () => {
    const contentType: ContentType = {
      $schema: 'content-type-v1',
      $id: 'post',
      name: 'post',
      plural: 'posts',
      label: 'Post',
      labelPlural: 'Posts',
      fields: [
        { key: 'title', label: 'Title', type: 'string' },
        {
          key: 'statusLabel',
          label: 'Status',
          type: 'select',
          options: {
            choices: [
              { value: 'draft', label: 'Draft' },
              { value: 'published', label: 'Published' },
            ],
          },
        },
        {
          key: 'authorRef',
          label: 'Author',
          type: 'relation',
          relation: { target: 'authors' },
        } as any,
      ],
      display: { primary: 'title', secondary: 'statusLabel' },
    };

    const entry: CollectionEntry = {
      $id: 'post-1',
      $type: 'post',
      $status: 'draft',
      $createdAt: '2026-01-01T00:00:00.000Z',
      $updatedAt: '2026-01-01T00:00:00.000Z',
      title: 'Field guide',
      statusLabel: 'published',
      authorRef: 'author-1',
    };

    const relationLabelsByField = {
      authorRef: {
        'author-1': 'Isaac Asimov',
      },
    };

    expect(matchesCollectionBrowseSearch(entry, 'published', contentType, relationLabelsByField)).toBe(true);
    expect(matchesCollectionBrowseSearch(entry, 'isaac', contentType, relationLabelsByField)).toBe(true);
    expect(matchesCollectionBrowseSearch(entry, 'author-1', contentType, relationLabelsByField)).toBe(true);
  });
});
