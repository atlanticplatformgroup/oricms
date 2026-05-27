import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { CollectionEntry } from '@ori/shared';
import {
  useEntrySelectionSync,
  useIdentifierStateSync,
  useDirtyEntryUnloadPrompt,
  useEntrySaveShortcut,
  createEntryFieldChangeHandler,
  buildIdentifierResetHandler,
} from '../useEntryEditorEffects';

vi.mock('../lib/schemaFieldComputed', () => ({
  applyDerivedSchemaFieldValues: vi.fn((_fields, values) => values),
  deriveSchemaFieldValue: vi.fn((sourceValue, strategy) => {
    if (strategy === 'slug') return String(sourceValue).toLowerCase().replace(/\s+/g, '-');
    return String(sourceValue);
  }),
}));

vi.mock('../lib/workspace/format', () => ({
  getDisplayText: vi.fn((value: unknown) => (typeof value === 'string' ? value : String(value ?? ''))),
}));

vi.mock('../useEntryEditorSupport', () => ({
  buildIdentifierState: vi.fn((_entry, configs) => {
    const state: Record<string, { auto: boolean; sourceLabel: string }> = {};
    configs.forEach((config: { fieldKey: string; sourceLabel: string }) => {
      state[config.fieldKey] = { auto: true, sourceLabel: config.sourceLabel };
    });
    return state;
  }),
  cloneEntry: vi.fn((entry) => JSON.parse(JSON.stringify(entry))),
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

describe('useEntrySelectionSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets state when selectedEntry is null', () => {
    const lastSyncedEntryIdRef = { current: 'entry-1|rev1' };
    const setDraftEntry = vi.fn();
    const setBaselineEntry = vi.fn();
    const setShowCommitBar = vi.fn();
    const setCommitMessage = vi.fn();
    const setIdentifierStateByField = vi.fn();
    const setCurrentRevision = vi.fn();

    renderHook(() =>
      useEntrySelectionSync({
        isDirty: false,
        lastSyncedEntryIdRef,
        selectedEntry: null,
        selectedEntryRevision: null,
        setBaselineEntry,
        setCommitMessage,
        setCurrentRevision,
        setDraftEntry,
        setIdentifierStateByField,
        setShowCommitBar,
      }),
    );

    expect(lastSyncedEntryIdRef.current).toBeNull();
    expect(setDraftEntry).toHaveBeenCalledWith(null);
    expect(setBaselineEntry).toHaveBeenCalledWith(null);
    expect(setShowCommitBar).toHaveBeenCalledWith(false);
    expect(setCommitMessage).toHaveBeenCalledWith('');
    expect(setIdentifierStateByField).toHaveBeenCalledWith({});
  });

  it('sets draft and baseline when entry switches', () => {
    const lastSyncedEntryIdRef = { current: null as string | null };
    const setDraftEntry = vi.fn();
    const setBaselineEntry = vi.fn();
    const setShowCommitBar = vi.fn();
    const setCommitMessage = vi.fn();
    const setIdentifierStateByField = vi.fn();
    const setCurrentRevision = vi.fn();

    const entry = createEntry({ $id: 'entry-1', title: 'Hello' });

    renderHook(() =>
      useEntrySelectionSync({
        isDirty: false,
        lastSyncedEntryIdRef,
        selectedEntry: entry,
        selectedEntryRevision: 'rev1',
        setBaselineEntry,
        setCommitMessage,
        setCurrentRevision,
        setDraftEntry,
        setIdentifierStateByField,
        setShowCommitBar,
      }),
    );

    expect(setDraftEntry).toHaveBeenCalledTimes(1);
    expect(setBaselineEntry).toHaveBeenCalledTimes(1);
    expect(setCurrentRevision).toHaveBeenCalledWith('rev1');
    expect(setShowCommitBar).toHaveBeenCalledWith(false);
    expect(setCommitMessage).toHaveBeenCalledWith('');
  });

  it('preserves dirty state for same entry', () => {
    const lastSyncedEntryIdRef = { current: 'entry-1|rev1' };
    const setDraftEntry = vi.fn();
    const setBaselineEntry = vi.fn();
    const setShowCommitBar = vi.fn();
    const setCommitMessage = vi.fn();
    const setIdentifierStateByField = vi.fn();
    const setCurrentRevision = vi.fn();

    const entry = createEntry({ $id: 'entry-1', title: 'Hello' });

    renderHook(() =>
      useEntrySelectionSync({
        isDirty: true,
        lastSyncedEntryIdRef,
        selectedEntry: entry,
        selectedEntryRevision: 'rev1',
        setBaselineEntry,
        setCommitMessage,
        setCurrentRevision,
        setDraftEntry,
        setIdentifierStateByField,
        setShowCommitBar,
      }),
    );

    expect(setDraftEntry).not.toHaveBeenCalled();
    expect(setBaselineEntry).not.toHaveBeenCalled();
  });
});

describe('useIdentifierStateSync', () => {
  it('resets state when selectedEntry is null', () => {
    const lastSyncedIdentifierEntryIdRef = { current: 'entry-1' };
    const setIdentifierStateByField = vi.fn();

    renderHook(() =>
      useIdentifierStateSync({
        derivedIdentifierConfig: [],
        isDirty: false,
        lastSyncedIdentifierEntryIdRef,
        selectedEntry: null,
        setIdentifierStateByField,
      }),
    );

    expect(lastSyncedIdentifierEntryIdRef.current).toBeNull();
    expect(setIdentifierStateByField).toHaveBeenCalledWith({});
  });

  it('builds identifier state when entry switches', () => {
    const lastSyncedIdentifierEntryIdRef = { current: null as string | null };
    const setIdentifierStateByField = vi.fn();

    const entry = createEntry({ $id: 'entry-1' });

    renderHook(() =>
      useIdentifierStateSync({
        derivedIdentifierConfig: [{ fieldKey: 'slug', sourceKey: 'title', sourceLabel: 'Title', strategy: 'slug' }],
        isDirty: false,
        lastSyncedIdentifierEntryIdRef,
        selectedEntry: entry,
        setIdentifierStateByField,
      }),
    );

    expect(setIdentifierStateByField).toHaveBeenCalledTimes(1);
  });
});

describe('useDirtyEntryUnloadPrompt', () => {
  it('registers beforeunload when dirty', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useDirtyEntryUnloadPrompt(true));

    expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('does not register beforeunload when not dirty', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    renderHook(() => useDirtyEntryUnloadPrompt(false));

    expect(addEventListenerSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));

    addEventListenerSpy.mockRestore();
  });
});

describe('useEntrySaveShortcut', () => {
  it('triggers save on Ctrl+S', () => {
    const handleSaveEntry = vi.fn();

    renderHook(() =>
      useEntrySaveShortcut({
        canUpdateEntries: true,
        handleSaveEntry,
        selectedEntryId: 'entry-1',
        showCommitBar: false,
      }),
    );

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(handleSaveEntry).toHaveBeenCalledTimes(1);
  });

  it('does not trigger save when commit bar is open', () => {
    const handleSaveEntry = vi.fn();

    renderHook(() =>
      useEntrySaveShortcut({
        canUpdateEntries: true,
        handleSaveEntry,
        selectedEntryId: 'entry-1',
        showCommitBar: true,
      }),
    );

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    window.dispatchEvent(event);

    expect(handleSaveEntry).not.toHaveBeenCalled();
  });

  it('does not trigger save without permission', () => {
    const handleSaveEntry = vi.fn();

    renderHook(() =>
      useEntrySaveShortcut({
        canUpdateEntries: false,
        handleSaveEntry,
        selectedEntryId: 'entry-1',
        showCommitBar: false,
      }),
    );

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    window.dispatchEvent(event);

    expect(handleSaveEntry).not.toHaveBeenCalled();
  });
});

describe('createEntryFieldChangeHandler', () => {
  it('updates draft entry with new field value', () => {
    const setDraftEntry = vi.fn();
    const setIdentifierStateByField = vi.fn();
    const entry = createEntry({ title: 'Old' });

    const handler = createEntryFieldChangeHandler({
      derivedIdentifierConfig: [],
      editorFields: [],
      identifierStateByField: {},
      setDraftEntry,
      setIdentifierStateByField,
    });

    handler('title', 'New');

    expect(setDraftEntry).toHaveBeenCalledWith(expect.any(Function));
    const updater = setDraftEntry.mock.calls[0][0] as (prev: CollectionEntry | null) => CollectionEntry | null;
    const result = updater(entry);
    expect(result?.title).toBe('New');
  });

  it('sets $publishedAt when transitioning to published', () => {
    const setDraftEntry = vi.fn();
    const setIdentifierStateByField = vi.fn();
    const entry = createEntry({ $status: 'draft' });

    const handler = createEntryFieldChangeHandler({
      derivedIdentifierConfig: [],
      editorFields: [],
      identifierStateByField: {},
      setDraftEntry,
      setIdentifierStateByField,
    });

    handler('$status', 'published');

    const updater = setDraftEntry.mock.calls[0][0] as (prev: CollectionEntry | null) => CollectionEntry | null;
    const result = updater(entry);
    expect(result?.$status).toBe('published');
    expect(result?.$publishedAt).toBeDefined();
  });

  it('removes $publishedAt when transitioning to draft', () => {
    const setDraftEntry = vi.fn();
    const setIdentifierStateByField = vi.fn();
    const entry = createEntry({ $status: 'published', $publishedAt: '2024-01-01T00:00:00Z' });

    const handler = createEntryFieldChangeHandler({
      derivedIdentifierConfig: [],
      editorFields: [],
      identifierStateByField: {},
      setDraftEntry,
      setIdentifierStateByField,
    });

    handler('$status', 'draft');

    const updater = setDraftEntry.mock.calls[0][0] as (prev: CollectionEntry | null) => CollectionEntry | null;
    const result = updater(entry);
    expect(result?.$status).toBe('draft');
    expect(result?.$publishedAt).toBeUndefined();
  });
});

describe('buildIdentifierResetHandler', () => {
  it('resets identifier to derived value and sets auto', () => {
    const setDraftEntry = vi.fn();
    const setIdentifierStateByField = vi.fn();
    const entry = createEntry({ title: 'Hello World', slug: 'custom-slug' });

    const handler = buildIdentifierResetHandler({
      derivedIdentifierConfig: [{ fieldKey: 'slug', sourceKey: 'title', sourceLabel: 'Title', strategy: 'slug' }],
      draftEntry: entry,
      setDraftEntry,
      setIdentifierStateByField,
    });

    handler('slug');

    expect(setIdentifierStateByField).toHaveBeenCalledWith(expect.any(Function));
    const stateUpdater = setIdentifierStateByField.mock.calls[0][0] as (prev: Record<string, unknown>) => Record<string, unknown>;
    const newState = stateUpdater({});
    expect(newState).toEqual({ slug: { auto: true, sourceLabel: 'Title' } });

    expect(setDraftEntry).toHaveBeenCalledWith(expect.any(Function));
    const draftUpdater = setDraftEntry.mock.calls[0][0] as (prev: CollectionEntry | null) => CollectionEntry | null;
    const newDraft = draftUpdater(entry);
    expect(newDraft?.slug).toBe('hello-world');
  });
});
