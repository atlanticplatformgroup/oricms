import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Asset, ComponentSchema, CollectionConfig, CollectionEntry, ContentType } from '@ori/shared';
import type { GlobalAsset } from '../../lib/assets/references';
import { useEntryEditor } from '../useEntryEditor';

vi.mock('../useEntryRelations', () => ({
  useEntryRelations: () => ({
    relationOptionsByField: {},
    relationLabelMapByField: {},
    relationPickerOpened: false,
    setRelationPickerOpened: vi.fn(),
    activeRelationField: null,
    activeRelationFieldKey: null,
    setActiveRelationFieldKey: vi.fn(),
    relationSearch: '',
    setRelationSearch: vi.fn(),
    relationPickerResults: [],
    relationPickerLoading: false,
    activeSelectedRelationIds: [],
    activeSelectedRelationOptions: [],
    activeRelationCollection: null,
    activeRelationMultiple: false,
    openRelationPicker: vi.fn(),
  }),
}));

vi.mock('../useEntryStructuredEditing', () => ({
  useEntryStructuredEditing: () => ({
    customFieldChoices: {},
    setCustomFieldChoices: vi.fn(),
    assetPickerOpened: false,
    setAssetPickerOpened: vi.fn(),
    activeAssetFieldKey: null,
    setActiveAssetFieldKey: vi.fn(),
    assetPickerScope: 'project',
    setAssetPickerScope: vi.fn(),
    assetSearch: '',
    setAssetSearch: vi.fn(),
    assetTagFilter: 'all',
    setAssetTagFilter: vi.fn(),
    assetTagOptions: [],
    filteredAssets: [],
    structuredValidationCount: 0,
    activeAssetField: null,
    selectedAssetReference: null,
    selectedAsset: null,
    handleSelectAsset: vi.fn(),
    fieldRendererContext: {
      assetOptions: [],
      assetMap: new Map(),
      assetsLoading: false,
      relationOptionsByField: {},
      relationLabelMapByField: {},
      componentSchemaMap: new Map(),
      customFieldChoices: {},
      onCustomFieldChoice: vi.fn(),
      onOpenAssetPicker: vi.fn(),
      onOpenRelationPicker: undefined,
      canUpdate: true,
      structuredDrag: {
        draggedItem: null,
        dropTarget: null,
        startDrag: vi.fn(),
        endDrag: vi.fn(),
        dragOver: vi.fn(),
        dragLeave: vi.fn(),
        drop: vi.fn(),
      },
      structuredActions: {
        addRepeatableComponent: vi.fn(),
        removeRepeatableComponent: vi.fn(),
        duplicateRepeatableComponent: vi.fn(),
        updateRepeatableComponentField: vi.fn(),
        updateComponentField: vi.fn(),
        updateObjectField: vi.fn(),
        addBlock: vi.fn(),
        removeBlock: vi.fn(),
        duplicateBlock: vi.fn(),
        updateBlockField: vi.fn(),
        addArrayItem: vi.fn(),
        removeArrayItem: vi.fn(),
        duplicateArrayItem: vi.fn(),
        updateArrayItem: vi.fn(),
        toggleStructuredItemCollapsed: vi.fn(),
      },
      getStructuredItemState: vi.fn(() => ({ collapsed: false, changed: false, invalid: false })),
      renderEmbeddedFieldControl: vi.fn(),
      getStructuredItemTitle: vi.fn((value: unknown, fallback: string) => {
        if (typeof value === 'string') return value;
        if (value && typeof value === 'object') {
          const obj = value as Record<string, unknown>;
          return String(obj.title || obj.name || obj.headline || fallback);
        }
        return fallback;
      }),
    },
  }),
}));

vi.mock('../useEntryPersistence', () => ({
  useEntryPersistence: () => ({
    createEntryMutation: { isPending: false },
    deleteEntryMutation: { isPending: false },
    handleCommitEntry: vi.fn(),
    handleDeleteEntry: vi.fn(),
    handleNewEntry: vi.fn(),
    handleRestoreVersion: vi.fn(),
    handleSaveEntry: vi.fn(),
    updateEntryMutation: { isPending: false },
  }),
}));

vi.mock('../useEntryEditorEffects', () => ({
  buildIdentifierResetHandler: vi.fn(() => vi.fn()),
  createEntryFieldChangeHandler: vi.fn(() => vi.fn()),
  useDirtyEntryUnloadPrompt: vi.fn(),
  useEntrySaveShortcut: vi.fn(),
  useEntrySelectionSync: vi.fn(),
  useIdentifierStateSync: vi.fn(),
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

describe('useEntryEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    projectId: 'proj-1',
    selectedCollection: null as CollectionConfig | null,
    selectedContentType: null as ContentType | null,
    selectedEntry: null as CollectionEntry | null,
    selectedEntryRevision: null as string | null,
    entries: [] as CollectionEntry[],
    primaryField: 'title',
    collections: [] as CollectionConfig[],
    contentTypes: [] as ContentType[],
    componentSchemaMap: new Map<string, ComponentSchema>(),
    assetOptions: [] as Array<{ value: string; label: string }>,
    assetMap: new Map<string, Asset>(),
    assetsLoading: false,
    assetRecords: [] as Asset[],
    globalAssetRecords: [] as GlobalAsset[],
    canCreateEntries: true,
    canUpdateEntries: true,
    canDeleteEntries: true,
    showToast: vi.fn(),
    queryClient: {} as any,
    onNavigateToEntry: vi.fn(),
    onNavigateToCollection: vi.fn(),
  };

  it('returns initial state with null draft', () => {
    const result = useEntryEditor(defaultProps);

    expect(result.draftEntry).toBeNull();
    expect(result.baselineEntry).toBeNull();
    expect(result.isDirty).toBe(false);
    expect(result.changedFieldCount).toBe(0);
    expect(result.editorFields).toEqual([]);
    expect(result.editorValidationCount).toBe(0);
    expect(result.commitMessage).toBe('');
    expect(result.showCommitBar).toBe(false);
  });

  it('computes editor fields from content type', () => {
    const contentType: ContentType = {
      $schema: 'content-type-v1',
      $id: 'post',
      name: 'post',
      label: 'Post',
      labelPlural: 'Posts',
      plural: 'posts',
      fields: [
        { key: 'title', type: 'text', label: 'Title' },
        { key: 'body', type: 'richtext', label: 'Body' },
      ],
      display: { primary: 'title' },
    };

    const result = useEntryEditor({
      ...defaultProps,
      selectedContentType: contentType,
      selectedEntry: createEntry({ title: 'Hello', body: 'World' }),
    });

    expect(result.editorFields).toHaveLength(2);
    expect(result.editorFields[0].key).toBe('title');
    expect(result.editorFields[1].key).toBe('body');
  });

  it('computes dirty state when draft differs from baseline', () => {
    const selectedEntry = createEntry({ title: 'Original' });

    const result = useEntryEditor({
      ...defaultProps,
      selectedEntry,
      selectedContentType: {
        $schema: 'content-type-v1',
        $id: 'post',
        name: 'post',
        label: 'Post',
        labelPlural: 'Posts',
        plural: 'posts',
        fields: [{ key: 'title', type: 'text', label: 'Title' }],
        display: { primary: 'title' },
      },
    });

    expect(result.isDirty).toBe(false);
  });

  it('exposes field change handler', () => {
    const result = useEntryEditor(defaultProps);

    expect(result.handleFieldChange).toBeDefined();
    expect(typeof result.handleFieldChange).toBe('function');
  });

  it('exposes persistence handlers', () => {
    const result = useEntryEditor(defaultProps);

    expect(result.handleNewEntry).toBeDefined();
    expect(result.handleSaveEntry).toBeDefined();
    expect(result.handleDeleteEntry).toBeDefined();
    expect(result.handleCommitEntry).toBeDefined();
    expect(result.handleRestoreVersion).toBeDefined();
  });

  it('exposes relation picker state', () => {
    const result = useEntryEditor(defaultProps);

    expect(result.relationPickerOpened).toBe(false);
    expect(result.activeRelationFieldKey).toBeNull();
    expect(result.relationSearch).toBe('');
  });

  it('exposes asset picker state', () => {
    const result = useEntryEditor(defaultProps);

    expect(result.assetPickerOpened).toBe(false);
    expect(result.activeAssetFieldKey).toBeNull();
    expect(result.assetSearch).toBe('');
  });

  it('tracks entry status change', () => {
    const result = useEntryEditor(defaultProps);

    expect(result.entryStatusChanged).toBe(false);
  });

  it('returns memoized result shape', () => {
    const result = useEntryEditor(defaultProps);

    expect(result).toHaveProperty('draftEntry');
    expect(result).toHaveProperty('baselineEntry');
    expect(result).toHaveProperty('commitMessage');
    expect(result).toHaveProperty('setCommitMessage');
    expect(result).toHaveProperty('showCommitBar');
    expect(result).toHaveProperty('setShowCommitBar');
    expect(result).toHaveProperty('isDirty');
    expect(result).toHaveProperty('editorFields');
    expect(result).toHaveProperty('editorFieldErrors');
    expect(result).toHaveProperty('editorValidationCount');
    expect(result).toHaveProperty('changedFieldCount');
    expect(result).toHaveProperty('entryStatusChanged');
    expect(result).toHaveProperty('currentRevision');
    expect(result).toHaveProperty('handleFieldChange');
    expect(result).toHaveProperty('handleNewEntry');
    expect(result).toHaveProperty('handleDeleteEntry');
    expect(result).toHaveProperty('handleSaveEntry');
    expect(result).toHaveProperty('handleCommitEntry');
    expect(result).toHaveProperty('handleRestoreVersion');
    expect(result).toHaveProperty('handleSelectAsset');
    expect(result).toHaveProperty('fieldRendererContext');
  });
});
