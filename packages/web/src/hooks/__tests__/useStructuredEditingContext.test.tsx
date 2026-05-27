import { describe, expect, it, vi } from 'vitest';
import type { DragEvent } from 'react';
import type { Asset, ComponentSchema, CollectionEntry, SchemaField } from '@ori/shared';
import { createStructuredDragContext, buildStructuredFieldRendererContext } from '../useStructuredEditingContext';
import type { StructuredDragItem } from '../../lib/entries/types';

function createDragEvent(): DragEvent<HTMLElement> {
  return {
    dataTransfer: {
      effectAllowed: '',
      setData: vi.fn(),
    } as unknown as DataTransfer,
    preventDefault: vi.fn(),
  } as unknown as DragEvent<HTMLElement>;
}

function createDragItem(overrides: Partial<StructuredDragItem> = {}): StructuredDragItem {
  return {
    kind: 'component',
    fieldKey: 'hero',
    index: 0,
    ...overrides,
  };
}

describe('createStructuredDragContext', () => {
  it('initializes with null drag state', () => {
    const setDragged = vi.fn();
    const setDrop = vi.fn();
    const onDrop = vi.fn();

    const ctx = createStructuredDragContext({
      draggedStructuredItem: null,
      dropStructuredItem: null,
      setDraggedStructuredItem: setDragged,
      setDropStructuredItem: setDrop,
      onDrop,
    });

    expect(ctx.draggedItem).toBeNull();
    expect(ctx.dropTarget).toBeNull();
  });

  it('sets dragged item on startDrag', () => {
    const setDragged = vi.fn();
    const setDrop = vi.fn();
    const item = createDragItem();

    const ctx = createStructuredDragContext({
      draggedStructuredItem: null,
      dropStructuredItem: null,
      setDraggedStructuredItem: setDragged,
      setDropStructuredItem: setDrop,
      onDrop: vi.fn(),
    });

    const event = createDragEvent();
    ctx.startDrag(event, item);

    expect(event.dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'component:hero:0');
    expect(setDragged).toHaveBeenCalledWith(item);
  });

  it('clears drag state on endDrag', () => {
    const setDragged = vi.fn();
    const setDrop = vi.fn();

    const ctx = createStructuredDragContext({
      draggedStructuredItem: createDragItem(),
      dropStructuredItem: createDragItem({ index: 1 }),
      setDraggedStructuredItem: setDragged,
      setDropStructuredItem: setDrop,
      onDrop: vi.fn(),
    });

    ctx.endDrag();

    expect(setDragged).toHaveBeenCalledWith(null);
    expect(setDrop).toHaveBeenCalledWith(null);
  });

  it('sets drop target on dragOver when same kind and field', () => {
    const setDrop = vi.fn();
    const dragged = createDragItem({ index: 0 });
    const target = createDragItem({ index: 1 });

    const ctx = createStructuredDragContext({
      draggedStructuredItem: dragged,
      dropStructuredItem: null,
      setDraggedStructuredItem: vi.fn(),
      setDropStructuredItem: setDrop,
      onDrop: vi.fn(),
    });

    const event = createDragEvent();
    ctx.dragOver(event, target);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(setDrop).toHaveBeenCalledWith(target);
  });

  it('does not set drop target on dragOver when same index', () => {
    const setDrop = vi.fn();
    const dragged = createDragItem({ index: 0 });

    const ctx = createStructuredDragContext({
      draggedStructuredItem: dragged,
      dropStructuredItem: null,
      setDraggedStructuredItem: vi.fn(),
      setDropStructuredItem: setDrop,
      onDrop: vi.fn(),
    });

    const event = createDragEvent();
    ctx.dragOver(event, dragged);

    expect(setDrop).not.toHaveBeenCalled();
  });

  it('clears drop target on dragLeave when matching', () => {
    const setDrop = vi.fn();
    const dropTarget = createDragItem({ index: 1 });

    const ctx = createStructuredDragContext({
      draggedStructuredItem: createDragItem({ index: 0 }),
      dropStructuredItem: dropTarget,
      setDraggedStructuredItem: vi.fn(),
      setDropStructuredItem: setDrop,
      onDrop: vi.fn(),
    });

    ctx.dragLeave(dropTarget);

    expect(setDrop).toHaveBeenCalledWith(null);
  });

  it('calls onDrop and clears state', () => {
    const onDrop = vi.fn();
    const setDragged = vi.fn();
    const setDrop = vi.fn();
    const target = createDragItem({ index: 1 });

    const ctx = createStructuredDragContext({
      draggedStructuredItem: createDragItem({ index: 0 }),
      dropStructuredItem: target,
      setDraggedStructuredItem: setDragged,
      setDropStructuredItem: setDrop,
      onDrop,
    });

    ctx.drop(target);

    expect(onDrop).toHaveBeenCalledWith(target);
    expect(setDragged).toHaveBeenCalledWith(null);
    expect(setDrop).toHaveBeenCalledWith(null);
  });
});

describe('buildStructuredFieldRendererContext', () => {
  function createArgs(overrides: Record<string, unknown> = {}) {
    return {
      assetMap: new Map<string, Asset>(),
      assetOptions: [],
      assetsLoading: false,
      baselineEntry: null,
      canUpdateEntries: true,
      collapsedStructuredItems: {},
      componentSchemaMap: new Map<string, ComponentSchema>(),
      customFieldChoices: {},
      draftEntry: null,
      dragContext: createStructuredDragContext({
        draggedStructuredItem: null,
        dropStructuredItem: null,
        setDraggedStructuredItem: vi.fn(),
        setDropStructuredItem: vi.fn(),
        onDrop: vi.fn(),
      }),
      editorFields: [] as SchemaField[],
      onCustomFieldChoice: vi.fn(),
      onOpenAssetPicker: vi.fn(),
      relationLabelMapByField: {},
      relationOptionsByField: {},
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
      toggleStructuredItemCollapsed: vi.fn(),
      ...overrides,
    };
  }

  it('returns field renderer context with required properties', () => {
    const args = createArgs();
    const ctx = buildStructuredFieldRendererContext(args);

    expect(ctx.assetOptions).toEqual([]);
    expect(ctx.assetMap).toBeInstanceOf(Map);
    expect(ctx.canUpdate).toBe(true);
    expect(ctx.structuredActions).toBeDefined();
    expect(ctx.getStructuredItemState).toBeDefined();
    expect(ctx.getStructuredItemTitle).toBeDefined();
    expect(ctx.renderEmbeddedFieldControl).toBeDefined();
  });

  it('includes relation options and label map', () => {
    const args = createArgs({
      relationOptionsByField: { author: [{ value: 'a1', label: 'Alice' }] },
      relationLabelMapByField: { author: { a1: 'Alice' } },
    });
    const ctx = buildStructuredFieldRendererContext(args);

    expect(ctx.relationOptionsByField).toEqual({ author: [{ value: 'a1', label: 'Alice' }] });
    expect(ctx.relationLabelMapByField).toEqual({ author: { a1: 'Alice' } });
  });

  it('getStructuredItemState detects changed items', () => {
    const args = createArgs({
      baselineEntry: { $id: '1', $type: 'post', $status: 'draft', $createdAt: '2024-01-01T00:00:00Z', $updatedAt: '2024-01-01T00:00:00Z', title: 'Original' } as unknown as CollectionEntry,
      draftEntry: { $id: '1', $type: 'post', $status: 'draft', $createdAt: '2024-01-01T00:00:00Z', $updatedAt: '2024-01-01T00:00:00Z', title: 'Modified', hero: [{ $id: 'c1', title: 'Changed' }] } as unknown as CollectionEntry,
      editorFields: [{ key: 'hero', type: 'component' } as SchemaField],
    });
    const ctx = buildStructuredFieldRendererContext(args);
    const state = ctx.getStructuredItemState?.({ kind: 'component', fieldKey: 'hero', index: 0 });

    expect(state?.changed).toBe(true);
    expect(state?.collapsed).toBe(false);
  });

  it('getStructuredItemState detects collapsed items', () => {
    const args = createArgs({
      collapsedStructuredItems: { 'component:hero:0': true },
    });
    const ctx = buildStructuredFieldRendererContext(args);
    const state = ctx.getStructuredItemState?.({ kind: 'component', fieldKey: 'hero', index: 0 });

    expect(state?.collapsed).toBe(true);
  });

  it('getStructuredItemTitle returns fallback for unknown values', () => {
    const ctx = buildStructuredFieldRendererContext(createArgs());
    const title = ctx.getStructuredItemTitle?.({ unknown: 'value' }, 'Fallback');

    expect(title).toBe('Fallback');
  });

  it('getStructuredItemTitle extracts title from object', () => {
    const ctx = buildStructuredFieldRendererContext(createArgs());
    const title = ctx.getStructuredItemTitle?.({ title: 'My Title', name: 'Name' }, 'Fallback');

    expect(title).toBe('My Title');
  });
});
