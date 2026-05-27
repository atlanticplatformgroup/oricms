import type { Dispatch, DragEvent as ReactDragEvent, SetStateAction } from 'react';
import { type Asset, type ComponentSchema, type CollectionEntry, type SchemaField } from '@ori/shared';
import { EditorField } from '../components/fields/EditorField';
import type { FieldRendererContext } from '../components/fields/contracts';
import type { StructuredDragItem } from '../lib/entries/types';
import { getStructuredItemState, getStructuredItemTitle } from './useStructuredEditingSupport';

export function createStructuredDragContext(args: {
  draggedStructuredItem: StructuredDragItem | null;
  dropStructuredItem: StructuredDragItem | null;
  setDraggedStructuredItem: Dispatch<SetStateAction<StructuredDragItem | null>>;
  setDropStructuredItem: Dispatch<SetStateAction<StructuredDragItem | null>>;
  onDrop: (target: StructuredDragItem) => void;
}) {
  const clearStructuredDragState = () => {
    args.setDraggedStructuredItem(null);
    args.setDropStructuredItem(null);
  };

  return {
    draggedItem: args.draggedStructuredItem,
    dropTarget: args.dropStructuredItem,
    startDrag: (event: ReactDragEvent<HTMLElement>, item: StructuredDragItem) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `${item.kind}:${item.fieldKey}:${item.index}`);
      args.setDraggedStructuredItem(item);
    },
    endDrag: clearStructuredDragState,
    dragOver: (event: ReactDragEvent<HTMLElement>, item: StructuredDragItem) => {
      event.preventDefault();
      if (
        args.draggedStructuredItem?.kind === item.kind
        && args.draggedStructuredItem.fieldKey === item.fieldKey
        && args.draggedStructuredItem.index !== item.index
      ) {
        args.setDropStructuredItem(item);
      }
    },
    dragLeave: (item: StructuredDragItem) => {
      if (
        args.dropStructuredItem?.kind === item.kind
        && args.dropStructuredItem.fieldKey === item.fieldKey
        && args.dropStructuredItem.index === item.index
      ) {
        args.setDropStructuredItem(null);
      }
    },
    drop: (target: StructuredDragItem) => {
      args.onDrop(target);
      clearStructuredDragState();
    },
  };
}

export function buildStructuredFieldRendererContext(args: {
  assetMap: Map<string, Asset>;
  assetOptions: Array<{ value: string; label: string }>;
  assetsLoading: boolean;
  baselineEntry: CollectionEntry | null;
  canUpdateEntries: boolean;
  collapsedStructuredItems: Record<string, boolean>;
  componentSchemaMap: Map<string, ComponentSchema>;
  customFieldChoices: Record<string, string[]>;
  draftEntry: CollectionEntry | null;
  dragContext: ReturnType<typeof createStructuredDragContext>;
  editorFields: SchemaField[];
  onCustomFieldChoice: (fieldKey: string, values: string[]) => void;
  onOpenAssetPicker: (fieldKey: string) => void;
  relationLabelMapByField: Record<string, Record<string, string>>;
  relationOptionsByField: Record<string, Array<{ value: string; label: string }>>;
  structuredActions: FieldRendererContext['structuredActions'];
  toggleStructuredItemCollapsed: (item: StructuredDragItem) => void;
}) {
  const renderEmbeddedFieldControl = (
    embeddedField: SchemaField,
    embeddedValue: unknown,
    onChange: (value: unknown) => void,
  ) => (
    <EditorField
      field={embeddedField}
      value={embeddedValue}
      onChange={onChange}
      disabled={!args.canUpdateEntries}
      context={fieldRendererContext}
    />
  );

  const fieldRendererContext: FieldRendererContext = {
    assetOptions: args.assetOptions,
    assetMap: args.assetMap,
    assetsLoading: args.assetsLoading,
    relationOptionsByField: args.relationOptionsByField,
    relationLabelMapByField: args.relationLabelMapByField,
    componentSchemaMap: args.componentSchemaMap,
    customFieldChoices: args.customFieldChoices,
    onCustomFieldChoice: args.onCustomFieldChoice,
    onOpenAssetPicker: args.onOpenAssetPicker,
    onOpenRelationPicker: undefined,
    canUpdate: args.canUpdateEntries,
    structuredDrag: args.dragContext,
    structuredActions: {
      ...args.structuredActions,
      toggleStructuredItemCollapsed: args.toggleStructuredItemCollapsed,
    },
    getStructuredItemState: (item: StructuredDragItem) => getStructuredItemState({
      baselineEntry: args.baselineEntry,
      collapsedStructuredItems: args.collapsedStructuredItems,
      componentSchemaMap: args.componentSchemaMap,
      draftEntry: args.draftEntry,
      editorFields: args.editorFields,
      item,
    }),
    renderEmbeddedFieldControl,
    getStructuredItemTitle,
  };

  return fieldRendererContext;
}
