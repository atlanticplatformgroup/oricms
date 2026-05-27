import { describe, expect, it } from 'vitest';
import type { CollectionEntry, ContentType, SchemaField } from '@ori/shared';
import {
  cloneEntry,
  buildDerivedIdentifierConfig,
  buildEditorFieldErrors,
  buildIdentifierState,
  resolveInitialEditorValue,
} from '../useEntryEditorSupport';

function createEntry(overrides: Record<string, unknown> = {}): CollectionEntry {
  return {
    $id: '1',
    $type: 'post',
    $status: 'draft',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  } as CollectionEntry;
}

describe('cloneEntry', () => {
  it('creates a deep copy', () => {
    const entry = createEntry({
      title: 'Hello',
      nested: { value: 1 },
    });

    const cloned = cloneEntry(entry);
    expect(cloned).toEqual(entry);
    expect(cloned).not.toBe(entry);
    expect((cloned as Record<string, unknown>).nested).not.toBe((entry as Record<string, unknown>).nested);
  });
});

describe('buildDerivedIdentifierConfig', () => {
  it('finds slug fields with title source', () => {
    const fields: SchemaField[] = [
      { key: 'title', type: 'text', label: 'Title' },
      { key: 'slug', type: 'uid', label: 'Slug' },
    ];
    const fieldMap = new Map(fields.map((f) => [f.key, f]));

    const configs = buildDerivedIdentifierConfig(fields, fieldMap);
    expect(configs).toHaveLength(1);
    expect(configs[0].fieldKey).toBe('slug');
    expect(configs[0].sourceKey).toBe('title');
    expect(configs[0].strategy).toBe('slug');
  });

  it('respects explicit derivedFrom option', () => {
    const fields: SchemaField[] = [
      { key: 'name', type: 'text', label: 'Name' },
      { key: 'path', type: 'text', label: 'Path', options: { derivedFrom: 'name', deriveStrategy: 'lowercase' } },
    ];
    const fieldMap = new Map(fields.map((f) => [f.key, f]));

    const configs = buildDerivedIdentifierConfig(fields, fieldMap);
    expect(configs).toHaveLength(1);
    expect(configs[0].sourceKey).toBe('name');
    expect(configs[0].strategy).toBe('lowercase');
  });

  it('returns empty array when no derived fields exist', () => {
    const fields: SchemaField[] = [
      { key: 'title', type: 'text', label: 'Title' },
      { key: 'body', type: 'richtext', label: 'Body' },
    ];
    const fieldMap = new Map(fields.map((f) => [f.key, f]));

    expect(buildDerivedIdentifierConfig(fields, fieldMap)).toHaveLength(0);
  });
});

describe('buildEditorFieldErrors', () => {
  it('returns empty object when draft is null', () => {
    const fields: SchemaField[] = [
      { key: 'title', type: 'text', label: 'Title', required: true },
    ];
    expect(buildEditorFieldErrors(null, fields)).toEqual({});
  });

  it('returns errors for invalid required fields', () => {
    const fields: SchemaField[] = [
      { key: 'title', type: 'text', label: 'Title', required: true },
      { key: 'body', type: 'richtext', label: 'Body' },
    ];
    const draft = createEntry({ title: '', body: 'content' });

    const errors = buildEditorFieldErrors(draft, fields);
    expect(errors.title).toBeDefined();
    expect(errors.body).toBeUndefined();
  });

  it('returns empty object when all fields are valid', () => {
    const fields: SchemaField[] = [
      { key: 'title', type: 'text', label: 'Title' },
    ];
    const draft = createEntry({ title: 'Valid' });

    expect(buildEditorFieldErrors(draft, fields)).toEqual({});
  });
});

describe('buildIdentifierState', () => {
  it('marks auto when current matches derived', () => {
    const entry = createEntry({ slug: 'hello-world', title: 'Hello World' });
    const configs = [
      { fieldKey: 'slug', sourceKey: 'title', sourceLabel: 'Title', strategy: 'slug' as const },
    ];

    const state = buildIdentifierState(entry, configs);
    expect(state.slug.auto).toBe(true);
    expect(state.slug.sourceLabel).toBe('Title');
  });

  it('marks non-auto when current differs from derived', () => {
    const entry = createEntry({ slug: 'custom-slug', title: 'Hello World' });
    const configs = [
      { fieldKey: 'slug', sourceKey: 'title', sourceLabel: 'Title', strategy: 'slug' as const },
    ];

    const state = buildIdentifierState(entry, configs);
    expect(state.slug.auto).toBe(false);
  });

  it('marks auto when current is empty', () => {
    const entry = createEntry({ slug: '', title: 'Hello World' });
    const configs = [
      { fieldKey: 'slug', sourceKey: 'title', sourceLabel: 'Title', strategy: 'slug' as const },
    ];

    const state = buildIdentifierState(entry, configs);
    expect(state.slug.auto).toBe(true);
  });
});

describe('resolveInitialEditorValue', () => {
  it('returns draft entry when available', () => {
    const contentType: ContentType = {
      $schema: 'content-type-v1',
      $id: 'post',
      name: 'post',
      plural: 'posts',
      label: 'Post',
      labelPlural: 'Posts',
      fields: [],
    };
    const draft = createEntry({ title: 'Draft' });
    const selected = createEntry({ title: 'Saved' });

    const result = resolveInitialEditorValue(contentType, draft, selected);
    expect(result.entry).toBe(draft);
    expect(result.selectedContentType).toBe(contentType);
  });

  it('falls back to selected entry when draft is null', () => {
    const contentType: ContentType = {
      $schema: 'content-type-v1',
      $id: 'post',
      name: 'post',
      plural: 'posts',
      label: 'Post',
      labelPlural: 'Posts',
      fields: [],
    };
    const selected = createEntry({ title: 'Saved' });

    const result = resolveInitialEditorValue(contentType, null, selected);
    expect(result.entry).toBe(selected);
  });
});
