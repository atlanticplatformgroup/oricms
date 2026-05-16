import { describe, expect, it } from 'vitest';
import type { CollectionEntry, ContentType } from '@ori/shared';
import { resolveCollectionBrowsePreview } from '../resolution';

describe('resolveCollectionBrowsePreview', () => {
  it('prefers display secondary text over slug-like identifiers', () => {
    const contentType: ContentType = {
      $schema: 'content-type-v1',
      $id: 'post',
      name: 'post',
      plural: 'posts',
      label: 'Post',
      labelPlural: 'Posts',
      fields: [
        { key: 'title', label: 'Title', type: 'string' },
        { key: 'slug', label: 'Slug', type: 'uid' },
        { key: 'subtitle', label: 'Subtitle', type: 'text' },
      ],
      display: { primary: 'title', secondary: 'subtitle' },
    };

    const entry: CollectionEntry = {
      $id: 'post-1',
      $type: 'post',
      $status: 'draft',
      $createdAt: '2026-01-01T00:00:00.000Z',
      $updatedAt: '2026-01-01T00:00:00.000Z',
      title: 'Field Guide',
      slug: 'field-guide',
      subtitle: 'Supporting entry used as a relation target.',
    };

    expect(resolveCollectionBrowsePreview({ contentType, entry })).toEqual({
      primary: 'Field Guide',
      summary: 'Supporting entry used as a relation target.',
      tertiary: null,
    });
  });

  it('falls back to an identifier only when no better supporting text exists', () => {
    const contentType: ContentType = {
      $schema: 'content-type-v1',
      $id: 'post',
      name: 'post',
      plural: 'posts',
      label: 'Post',
      labelPlural: 'Posts',
      fields: [
        { key: 'title', label: 'Title', type: 'string' },
        { key: 'slug', label: 'Slug', type: 'uid' },
      ],
      display: { primary: 'title' },
    };

    const entry: CollectionEntry = {
      $id: 'post-1',
      $type: 'post',
      $status: 'draft',
      $createdAt: '2026-01-01T00:00:00.000Z',
      $updatedAt: '2026-01-01T00:00:00.000Z',
      title: 'Field Guide',
      slug: 'field-guide',
    };

    expect(resolveCollectionBrowsePreview({ contentType, entry })).toEqual({
      primary: 'Field Guide',
      summary: null,
      tertiary: 'field-guide',
    });
  });
});
