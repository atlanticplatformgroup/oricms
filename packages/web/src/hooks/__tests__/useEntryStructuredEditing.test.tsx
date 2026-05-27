import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Asset, ComponentSchema, CollectionEntry, SchemaField } from '@ori/shared';
import type { GlobalAsset } from '../../lib/assets/references';
import { useEntryStructuredEditing } from '../useEntryStructuredEditing';

vi.mock('../useStructuredAssetPicker', () => ({
  useStructuredAssetPicker: () => ({
    activeAssetField: null,
    activeAssetFieldKey: null,
    assetPickerOpened: false,
    assetPickerScope: 'project',
    assetSearch: '',
    assetTagFilter: 'all',
    assetTagOptions: [],
    filteredAssets: [],
    selectedAsset: null,
    selectedAssetReference: null,
    handleOpenAssetPicker: vi.fn(),
    handleSelectAsset: vi.fn(),
    setActiveAssetFieldKey: vi.fn(),
    setAssetPickerOpened: vi.fn(),
    setAssetPickerScope: vi.fn(),
    setAssetSearch: vi.fn(),
    setAssetTagFilter: vi.fn(),
  }),
}));

function createEntry(overrides: Record<string, unknown> = {}): CollectionEntry {
  return {
    $id: 'entry-1',
    $type: 'post',
    $status: 'draft',
    $createdAt: '2024-01-01T00:00:00Z',
    $updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  } as CollectionEntry;
}

function createSchema(id: string, fields: SchemaField[] = []): ComponentSchema {
  return {
    $schema: 'component-v1',
    $id: id,
    name: id,
    label: id,
    fields,
  };
}

describe('useEntryStructuredEditing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    editorFields: [] as SchemaField[],
    draftEntry: null as CollectionEntry | null,
    baselineEntry: null as CollectionEntry | null,
    setDraftEntry: vi.fn(),
    componentSchemaMap: new Map<string, ComponentSchema>(),
    assetOptions: [] as Array<{ value: string; label: string }>,
    assetMap: new Map<string, Asset>(),
    assetsLoading: false,
    assetRecords: [] as Asset[],
    globalAssetRecords: [] as GlobalAsset[],
    canUpdateEntries: true,
    relationOptionsByField: {} as Record<string, Array<{ value: string; label: string }>>,
    relationLabelMapByField: {} as Record<string, Record<string, string>>,
    handleFieldChange: vi.fn(),
  };

  it('returns initial state', () => {
    const result = useEntryStructuredEditing(defaultProps);

    expect(result.customFieldChoices).toEqual({});
    expect(result.structuredValidationCount).toBe(0);
    expect(result.assetPickerOpened).toBe(false);
    expect(result.activeAssetFieldKey).toBeNull();
  });

  it('computes structured validation count for invalid component', () => {
    const schema = createSchema('hero', [
      { key: 'title', type: 'text', label: 'Title', required: true },
    ]);
    const componentSchemaMap = new Map([['hero', schema]]);
    const editorFields: SchemaField[] = [
      { key: 'hero', type: 'component', label: 'Hero', component: 'hero' } as SchemaField,
    ];
    const draftEntry = createEntry({ hero: { title: '' } });

    const result = useEntryStructuredEditing({
      ...defaultProps,
      editorFields,
      draftEntry,
      componentSchemaMap,
    });

    expect(result.structuredValidationCount).toBeGreaterThan(0);
  });

  it('exposes structured actions for component fields', () => {
    const result = useEntryStructuredEditing({
      ...defaultProps,
      draftEntry: createEntry(),
    });

    expect(result.fieldRendererContext.structuredActions).toBeDefined();
    expect(result.fieldRendererContext.structuredActions!.updateComponentField).toBeDefined();
  });

  it('exposes structured actions for object fields', () => {
    const result = useEntryStructuredEditing({
      ...defaultProps,
      draftEntry: createEntry({ meta: { seo: true } }),
    });

    expect(result.fieldRendererContext.structuredActions!.updateObjectField).toBeDefined();
  });

  it('exposes structured actions for repeatable components', () => {
    const result = useEntryStructuredEditing({
      ...defaultProps,
      draftEntry: createEntry({ items: [{ title: 'A' }] }),
    });

    expect(result.fieldRendererContext.structuredActions!.updateRepeatableComponentField).toBeDefined();
  });

  it('exposes structured actions for blocks', () => {
    const result = useEntryStructuredEditing({
      ...defaultProps,
      draftEntry: createEntry({ blocks: [{ $type: 'text', content: 'Hello' }] }),
    });

    expect(result.fieldRendererContext.structuredActions!.updateBlockField).toBeDefined();
  });

  it('exposes structured actions for array items', () => {
    const result = useEntryStructuredEditing({
      ...defaultProps,
      draftEntry: createEntry({ tags: ['a', 'b'] }),
    });

    expect(result.fieldRendererContext.structuredActions!.updateArrayItem).toBeDefined();
  });

  it('getStructuredItemTitle returns fallback for unknown values', () => {
    const result = useEntryStructuredEditing(defaultProps);
    const title = result.fieldRendererContext.getStructuredItemTitle!({ unknown: 'value' }, 'Fallback');

    expect(title).toBe('Fallback');
  });

  it('getStructuredItemTitle extracts title from object', () => {
    const result = useEntryStructuredEditing(defaultProps);
    const title = result.fieldRendererContext.getStructuredItemTitle!({ title: 'My Title', name: 'Name' }, 'Fallback');

    expect(title).toBe('My Title');
  });
});
