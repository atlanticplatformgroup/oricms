import { describe, expect, it } from 'vitest';
import type { CollectionEntry, ComponentSchema, SchemaField } from '@ori/shared';
import {
  deepClone,
  getStructuredItemKey,
  getStructuredItemTitle,
  getStructuredItemState,
  getStructuredValidationCount,
} from '../structuredEditingSupport';

describe('deepClone', () => {
  it('clones primitive values', () => {
    expect(deepClone(42)).toBe(42);
    expect(deepClone('hello')).toBe('hello');
  });

  it('deep clones nested objects', () => {
    const obj = { a: { b: [1, 2, { c: 3 }] } };
    const cloned = deepClone(obj);
    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
    expect(cloned.a).not.toBe(obj.a);
    expect(cloned.a.b).not.toBe(obj.a.b);
  });
});

describe('getStructuredItemKey', () => {
  it('formats key from kind, fieldKey, and index', () => {
    expect(getStructuredItemKey({ kind: 'component', fieldKey: 'hero', index: 0 })).toBe('component:hero:0');
    expect(getStructuredItemKey({ kind: 'array', fieldKey: 'tags', index: 3 })).toBe('array:tags:3');
  });
});

describe('getStructuredItemTitle', () => {
  it('returns string value directly', () => {
    expect(getStructuredItemTitle('Hello World', 'Fallback')).toBe('Hello World');
  });

  it('extracts title from object candidates', () => {
    expect(getStructuredItemTitle({ title: 'My Title', name: 'Name' }, 'Fallback')).toBe('My Title');
    expect(getStructuredItemTitle({ name: 'My Name' }, 'Fallback')).toBe('My Name');
    expect(getStructuredItemTitle({ headline: 'Headline' }, 'Fallback')).toBe('Headline');
  });

  it('falls back when no candidates match', () => {
    expect(getStructuredItemTitle({ other: 'value' }, 'Fallback')).toBe('Fallback');
    expect(getStructuredItemTitle(null, 'Fallback')).toBe('Fallback');
  });

  it('skips empty strings', () => {
    expect(getStructuredItemTitle({ title: '  ', name: 'Valid' }, 'Fallback')).toBe('Valid');
  });
});

describe('getStructuredItemState', () => {
  const editorFields: SchemaField[] = [
    { key: 'hero', type: 'component', label: 'Hero' },
  ];

  const componentSchemaMap = new Map<string, ComponentSchema>([
    ['hero-component', {
      $schema: 'component-v1',
      $id: 'hero-component',
      name: 'hero',
      label: 'Hero',
      fields: [{ key: 'title', type: 'text', label: 'Title', required: true }],
    }],
  ]);

  it('returns collapsed when no draft entry', () => {
    const state = getStructuredItemState({
      baselineEntry: null,
      collapsedStructuredItems: {},
      componentSchemaMap,
      draftEntry: null,
      editorFields,
      item: { kind: 'component', fieldKey: 'hero', index: 0 },
    });
    expect(state.collapsed).toBe(false);
    expect(state.changed).toBe(false);
    expect(state.invalid).toBe(false);
  });

  it('detects changed items', () => {
    const baseline = { $id: '1', $type: 'post', hero: [{ title: 'Old' }] } as unknown as CollectionEntry;
    const draft = { $id: '1', $type: 'post', hero: [{ title: 'New' }] } as unknown as CollectionEntry;

    const state = getStructuredItemState({
      baselineEntry: baseline,
      collapsedStructuredItems: {},
      componentSchemaMap,
      draftEntry: draft,
      editorFields,
      item: { kind: 'component', fieldKey: 'hero', index: 0 },
    });
    expect(state.changed).toBe(true);
  });

  it('detects unchanged items', () => {
    const entry = { $id: '1', $type: 'post', hero: [{ title: 'Same' }] } as unknown as CollectionEntry;

    const state = getStructuredItemState({
      baselineEntry: entry,
      collapsedStructuredItems: {},
      componentSchemaMap,
      draftEntry: entry,
      editorFields,
      item: { kind: 'component', fieldKey: 'hero', index: 0 },
    });
    expect(state.changed).toBe(false);
  });

  it('respects collapsed state', () => {
    const entry = { $id: '1', $type: 'post', hero: [] } as unknown as CollectionEntry;

    const state = getStructuredItemState({
      baselineEntry: entry,
      collapsedStructuredItems: { 'component:hero:0': true },
      componentSchemaMap,
      draftEntry: entry,
      editorFields,
      item: { kind: 'component', fieldKey: 'hero', index: 0 },
    });
    expect(state.collapsed).toBe(true);
  });
});

describe('getStructuredValidationCount', () => {
  const componentSchemaMap = new Map<string, ComponentSchema>([
    ['comp', {
      $schema: 'component-v1',
      $id: 'comp',
      name: 'comp',
      label: 'Comp',
      fields: [{ key: 'title', type: 'text', label: 'Title', required: true }],
    }],
  ]);

  it('returns 0 when no draft entry', () => {
    expect(getStructuredValidationCount({ componentSchemaMap, draftEntry: null, editorFields: [] })).toBe(0);
  });

  it('counts component field validation issues', () => {
    const draft = { $id: '1', $type: 'post', hero: [{ title: '' }] } as unknown as CollectionEntry;
    const fields: SchemaField[] = [
      { key: 'hero', type: 'component', label: 'Hero', component: 'comp', repeatable: true },
    ];

    expect(getStructuredValidationCount({ componentSchemaMap, draftEntry: draft, editorFields: fields })).toBe(1);
  });

  it('counts object field validation issues', () => {
    const draft = { $id: '1', $type: 'post', meta: { title: '' } } as unknown as CollectionEntry;
    const fields: SchemaField[] = [
      { key: 'meta', type: 'object', label: 'Meta', fields: [{ key: 'title', type: 'text', label: 'Title', required: true }] },
    ];

    expect(getStructuredValidationCount({ componentSchemaMap, draftEntry: draft, editorFields: fields })).toBe(1);
  });

  it('counts blocks validation issues', () => {
    const draft = { $id: '1', $type: 'post', content: [{ $type: 'comp', title: '' }] } as unknown as CollectionEntry;
    const fields: SchemaField[] = [
      { key: 'content', type: 'blocks', label: 'Content' },
    ];

    expect(getStructuredValidationCount({ componentSchemaMap, draftEntry: draft, editorFields: fields })).toBe(1);
  });

  it('counts array required empty strings', () => {
    const draft = { $id: '1', $type: 'post', tags: ['valid', ''] } as unknown as CollectionEntry;
    const fields: SchemaField[] = [
      { key: 'tags', type: 'array', label: 'Tags', required: true },
    ];

    expect(getStructuredValidationCount({ componentSchemaMap, draftEntry: draft, editorFields: fields })).toBe(1);
  });

  it('returns 0 for valid entries', () => {
    const draft = { $id: '1', $type: 'post', hero: [{ title: 'Valid' }] } as unknown as CollectionEntry;
    const fields: SchemaField[] = [
      { key: 'hero', type: 'component', label: 'Hero', component: 'comp' },
    ];

    expect(getStructuredValidationCount({ componentSchemaMap, draftEntry: draft, editorFields: fields })).toBe(0);
  });
});
