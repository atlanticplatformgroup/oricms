import { describe, expect, it } from 'vitest';
import type { ContentType, SchemaField } from '@ori/shared';
import { resolveEditorFieldWidth, resolveEditorSections } from '../editor';

describe('resolveEditorSections', () => {
  it('returns a single neutral section when the content type does not declare editor sections', () => {
    const fields: SchemaField[] = [
      { key: 'title', label: 'Title', type: 'string' },
      { key: 'summary', label: 'Summary', type: 'text' },
    ];

    expect(resolveEditorSections(null, fields)).toEqual([
      {
        id: '__ungrouped',
        fields,
      },
    ]);
  });

  it('groups fields into declared editor sections and preserves unassigned fields in a neutral fallback section', () => {
    const contentType: ContentType = {
      $schema: 'content-type-v1',
      $id: 'post',
      name: 'post',
      plural: 'posts',
      label: 'Post',
      labelPlural: 'Posts',
      fields: [],
      editor: {
        sections: [
          { id: 'content', label: 'Content', description: 'Primary fields.' },
          { id: 'seo', label: 'SEO', description: 'Search metadata.', defaultCollapsed: true },
        ],
      },
    };

    const titleField: SchemaField = {
      key: 'title',
      label: 'Title',
      type: 'string',
      options: { editor: { section: 'content' } },
    };
    const seoField: SchemaField = {
      key: 'seo',
      label: 'SEO',
      type: 'json',
      options: { editor: { section: 'seo' } },
    };
    const notesField: SchemaField = {
      key: 'notes',
      label: 'Notes',
      type: 'text',
    };

    expect(resolveEditorSections(contentType, [titleField, seoField, notesField])).toEqual([
      {
        id: 'content',
        title: 'Content',
        description: 'Primary fields.',
        collapsible: true,
        defaultCollapsed: false,
        fields: [titleField],
      },
      {
        id: 'seo',
        title: 'SEO',
        description: 'Search metadata.',
        collapsible: true,
        defaultCollapsed: true,
        fields: [seoField],
      },
      {
        id: '__ungrouped',
        fields: [notesField],
      },
    ]);
  });

  it('prefers explicit width hints and otherwise falls back to conservative short-field widths', () => {
    expect(resolveEditorFieldWidth({ key: 'title', label: 'Title', type: 'string' })).toBe('full');
    expect(resolveEditorFieldWidth({ key: 'readingMinutes', label: 'Reading minutes', type: 'number' })).toBe('half');
    expect(resolveEditorFieldWidth({ key: 'slug', label: 'Slug', type: 'uid' })).toBe('full');
    expect(resolveEditorFieldWidth({
      key: 'slug',
      label: 'Slug',
      type: 'uid',
      options: { editor: { width: 'full' } },
    })).toBe('full');
  });
});
