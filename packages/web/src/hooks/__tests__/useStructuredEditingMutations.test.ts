import { describe, expect, it } from 'vitest';
import type { CollectionEntry, ComponentSchema, SchemaField } from '@ori/shared';
import {
  patchObjectChild,
  patchIndexedObjectChild,
  addRepeatableStructuredItem,
  removeIndexedStructuredItem,
  duplicateIndexedStructuredItem,
  reorderIndexedStructuredItem,
  patchArrayItem,
  addArrayItem,
  duplicateArrayItem,
  buildObjectFieldFallback,
  patchComponentRoot,
} from '../useStructuredEditingMutations';

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

const sampleSchema: ComponentSchema = {
  $schema: 'component-v1',
  $id: 'test-comp',
  name: 'test',
  label: 'Test',
  fields: [{ key: 'title', type: 'text', label: 'Title', default: '' }],
};

describe('patchObjectChild', () => {
  it('patches a child property of an object field', () => {
    const entry = createEntry({ meta: { title: 'Old', desc: 'Desc' } });
    const result = patchObjectChild(entry, 'meta', 'title', 'New');
    expect(result?.meta).toEqual({ title: 'New', desc: 'Desc' });
    expect(result).not.toBe(entry);
  });

  it('returns null when previous is null', () => {
    expect(patchObjectChild(null, 'meta', 'title', 'New')).toBeNull();
  });

  it('uses fallback when field does not exist', () => {
    const entry = createEntry();
    const result = patchObjectChild(entry, 'meta', 'title', 'New', { default: true });
    expect(result?.meta).toEqual({ default: true, title: 'New' });
  });
});

describe('patchIndexedObjectChild', () => {
  it('patches a child in an array of objects', () => {
    const entry = createEntry({ items: [{ name: 'A' }, { name: 'B' }] });
    const result = patchIndexedObjectChild(entry, 'items', 1, 'name', 'Updated');
    expect((result?.items as unknown[])[1]).toEqual({ name: 'Updated' });
    expect((result?.items as unknown[])[0]).toEqual({ name: 'A' });
  });

  it('returns null when previous is null', () => {
    expect(patchIndexedObjectChild(null, 'items', 0, 'name', 'X')).toBeNull();
  });
});

describe('addRepeatableStructuredItem', () => {
  it('adds a new component item', () => {
    const entry = createEntry({ hero: [{ title: 'First' }] });
    const result = addRepeatableStructuredItem(entry, 'hero', sampleSchema);
    expect((result?.hero as unknown[])).toHaveLength(2);
    expect((result?.hero as unknown[])[1]).toEqual({ title: '' });
  });

  it('includes type when requested', () => {
    const entry = createEntry({ hero: [] });
    const result = addRepeatableStructuredItem(entry, 'hero', sampleSchema, true);
    expect((result?.hero as unknown[])[0]).toEqual({ $type: 'test-comp', title: '' });
  });

  it('returns null when previous is null', () => {
    expect(addRepeatableStructuredItem(null, 'hero', sampleSchema)).toBeNull();
  });
});

describe('removeIndexedStructuredItem', () => {
  it('removes item at index', () => {
    const entry = createEntry({ items: ['a', 'b', 'c'] });
    const result = removeIndexedStructuredItem(entry, 'items', 1);
    expect(result?.items).toEqual(['a', 'c']);
  });

  it('returns null when previous is null', () => {
    expect(removeIndexedStructuredItem(null, 'items', 0)).toBeNull();
  });
});

describe('duplicateIndexedStructuredItem', () => {
  it('duplicates item after original', () => {
    const entry = createEntry({ items: [{ id: 1 }, { id: 2 }] });
    const result = duplicateIndexedStructuredItem(entry, 'items', 0);
    expect((result?.items as unknown[])).toHaveLength(3);
    expect((result?.items as unknown[])[0]).toEqual({ id: 1 });
    expect((result?.items as unknown[])[1]).toEqual({ id: 1 });
    expect((result?.items as unknown[])[0]).not.toBe((result?.items as unknown[])[1]);
  });

  it('returns previous when index is out of bounds', () => {
    const entry = createEntry({ items: ['a'] });
    const result = duplicateIndexedStructuredItem(entry, 'items', 5);
    expect(result).toBe(entry);
  });

  it('returns null when previous is null', () => {
    expect(duplicateIndexedStructuredItem(null, 'items', 0)).toBeNull();
  });
});

describe('reorderIndexedStructuredItem', () => {
  it('moves item to target index', () => {
    const entry = createEntry({ items: ['a', 'b', 'c'] });
    const result = reorderIndexedStructuredItem(entry, 'items', 0, 2);
    expect(result?.items).toEqual(['b', 'c', 'a']);
  });

  it('returns previous when indices are equal', () => {
    const entry = createEntry({ items: ['a', 'b'] });
    const result = reorderIndexedStructuredItem(entry, 'items', 0, 0);
    expect(result).toBe(entry);
  });

  it('returns null when previous is null', () => {
    expect(reorderIndexedStructuredItem(null, 'items', 0, 1)).toBeNull();
  });
});

describe('patchArrayItem', () => {
  it('updates item at index', () => {
    const entry = createEntry({ tags: ['a', 'b', 'c'] });
    const result = patchArrayItem(entry, 'tags', 1, 'updated');
    expect(result?.tags).toEqual(['a', 'updated', 'c']);
  });

  it('returns null when previous is null', () => {
    expect(patchArrayItem(null, 'tags', 0, 'x')).toBeNull();
  });
});

describe('addArrayItem', () => {
  it('adds empty string by default', () => {
    const entry = createEntry({ tags: ['a'] });
    const result = addArrayItem(entry, 'tags');
    expect(result?.tags).toEqual(['a', '']);
  });

  it('adds number sample', () => {
    const entry = createEntry({ counts: [1] });
    const result = addArrayItem(entry, 'counts', 42);
    expect(result?.counts).toEqual([1, 0]);
  });

  it('adds boolean sample', () => {
    const entry = createEntry({ flags: [true] });
    const result = addArrayItem(entry, 'flags', false);
    expect(result?.flags).toEqual([true, false]);
  });

  it('returns null when previous is null', () => {
    expect(addArrayItem(null, 'tags')).toBeNull();
  });
});

describe('duplicateArrayItem', () => {
  it('duplicates item after original', () => {
    const entry = createEntry({ tags: ['a', 'b'] });
    const result = duplicateArrayItem(entry, 'tags', 0);
    expect(result?.tags).toEqual(['a', 'a', 'b']);
  });

  it('returns previous when index out of bounds', () => {
    const entry = createEntry({ tags: ['a'] });
    const result = duplicateArrayItem(entry, 'tags', 5);
    expect(result).toBe(entry);
  });

  it('returns null when previous is null', () => {
    expect(duplicateArrayItem(null, 'tags', 0)).toBeNull();
  });
});

describe('buildObjectFieldFallback', () => {
  it('returns empty object when field has no nested fields', () => {
    const fields: SchemaField[] = [{ key: 'meta', type: 'object', label: 'Meta' }];
    expect(buildObjectFieldFallback(fields, 'meta')).toEqual({});
  });

  it('creates structured value from nested fields', () => {
    const fields: SchemaField[] = [
      { key: 'meta', type: 'object', label: 'Meta', fields: [{ key: 'title', type: 'text', label: 'Title', default: '' }] },
    ];
    expect(buildObjectFieldFallback(fields, 'meta')).toEqual({ title: '' });
  });
});

describe('patchComponentRoot', () => {
  it('patches component root field', () => {
    const entry = createEntry({ hero: { title: 'Old', subtitle: 'Sub' } });
    const result = patchComponentRoot(entry, 'hero', 'title', 'New');
    expect(result?.hero).toEqual({ title: 'New', subtitle: 'Sub' });
  });

  it('returns null when previous is null', () => {
    expect(patchComponentRoot(null, 'hero', 'title', 'New')).toBeNull();
  });
});
