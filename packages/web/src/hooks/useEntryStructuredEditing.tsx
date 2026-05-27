import { type Dispatch, type SetStateAction, useMemo, useState } from 'react';
import { type Asset, type ComponentSchema, type CollectionEntry, type SchemaField } from '@ori/shared';
import type { GlobalAsset } from '../lib/assets/references';
import type { StructuredDragItem } from '../lib/entries/types';
import { getStructuredItemKey, getStructuredValidationCount } from './useStructuredEditingSupport';
import { useStructuredAssetPicker } from './useStructuredAssetPicker';
import { buildStructuredFieldRendererContext, createStructuredDragContext } from './useStructuredEditingContext';
import {
  addArrayItem,
  addRepeatableStructuredItem,
  buildObjectFieldFallback,
  duplicateArrayItem,
  duplicateIndexedStructuredItem,
  patchArrayItem,
  patchComponentRoot,
  patchIndexedObjectChild,
  patchObjectChild,
  removeIndexedStructuredItem,
  reorderIndexedStructuredItem,
} from './useStructuredEditingMutations';

interface UseEntryStructuredEditingOptions {
  editorFields: SchemaField[];
  draftEntry: CollectionEntry | null;
  baselineEntry: CollectionEntry | null;
  setDraftEntry: Dispatch<SetStateAction<CollectionEntry | null>>;
  componentSchemaMap: Map<string, ComponentSchema>;
  assetOptions: Array<{ value: string; label: string }>;
  assetMap: Map<string, Asset>;
  assetsLoading: boolean;
  assetRecords: Asset[];
  globalAssetRecords: GlobalAsset[];
  canUpdateEntries: boolean;
  relationOptionsByField: Record<string, Array<{ value: string; label: string }>>;
  relationLabelMapByField: Record<string, Record<string, string>>;
  handleFieldChange: (fieldKey: string, value: unknown) => void;
}

export function useEntryStructuredEditing({
  editorFields,
  draftEntry,
  baselineEntry,
  setDraftEntry,
  componentSchemaMap,
  assetOptions,
  assetMap,
  assetsLoading,
  assetRecords,
  globalAssetRecords,
  canUpdateEntries,
  relationOptionsByField,
  relationLabelMapByField,
  handleFieldChange,
}: UseEntryStructuredEditingOptions) {
  const [customFieldChoices, setCustomFieldChoices] = useState<Record<string, string[]>>({});
  const [draggedStructuredItem, setDraggedStructuredItem] = useState<StructuredDragItem | null>(null);
  const [dropStructuredItem, setDropStructuredItem] = useState<StructuredDragItem | null>(null);
  const [collapsedStructuredItems, setCollapsedStructuredItems] = useState<Record<string, boolean>>({});
  const {
    activeAssetField,
    activeAssetFieldKey,
    assetPickerOpened,
    assetPickerScope,
    assetSearch,
    assetTagFilter,
    assetTagOptions,
    filteredAssets,
    selectedAsset,
    selectedAssetReference,
    setAssetPickerOpened,
    handleOpenAssetPicker,
    handleSelectAsset,
    setActiveAssetFieldKey,
    setAssetPickerScope,
    setAssetSearch,
    setAssetTagFilter,
  } = useStructuredAssetPicker({
    activeFields: editorFields,
    assetMap,
    assetRecords,
    draftEntry,
    globalAssetRecords,
    handleFieldChange,
  });

  const handleComponentFieldChange = (fieldKey: string, childKey: string, value: unknown) => {
    setDraftEntry((previous) => patchComponentRoot(previous, fieldKey, childKey, value));
  };

  const handleObjectFieldChange = (fieldKey: string, childKey: string, value: unknown) => {
    const fallbackObject = buildObjectFieldFallback(editorFields, fieldKey);
    setDraftEntry((previous) => patchObjectChild(previous, fieldKey, childKey, value, fallbackObject));
  };

  const handleRepeatableComponentFieldChange = (fieldKey: string, index: number, childKey: string, value: unknown) => {
    setDraftEntry((previous) => patchIndexedObjectChild(previous, fieldKey, index, childKey, value));
  };

  const handleAddRepeatableComponent = (fieldKey: string, componentId: string) => {
    const schema = componentSchemaMap.get(componentId);
    if (!schema) return;
    setDraftEntry((previous) => addRepeatableStructuredItem(previous, fieldKey, schema));
  };

  const handleRemoveRepeatableComponent = (fieldKey: string, index: number) => {
    setDraftEntry((previous) => removeIndexedStructuredItem(previous, fieldKey, index));
  };

  const handleDuplicateRepeatableComponent = (fieldKey: string, index: number) => {
    setDraftEntry((previous) => duplicateIndexedStructuredItem(previous, fieldKey, index));
  };

  const handleReorderRepeatableComponent = (fieldKey: string, fromIndex: number, targetIndex: number) => {
    setDraftEntry((previous) => reorderIndexedStructuredItem(previous, fieldKey, fromIndex, targetIndex));
  };

  const handleBlockFieldChange = (fieldKey: string, index: number, childKey: string, value: unknown) => {
    setDraftEntry((previous) => {
      if (!previous) return previous;
      const nextBlocks = Array.isArray(previous[fieldKey]) ? [...(previous[fieldKey] as Array<Record<string, unknown>>)] : [];
      const currentBlock = nextBlocks[index] ? { ...nextBlocks[index] } : {};
      currentBlock[childKey] = value;
      nextBlocks[index] = currentBlock;
      return { ...previous, [fieldKey]: nextBlocks };
    });
  };

  const handleAddBlock = (fieldKey: string, componentId: string) => {
    const schema = componentSchemaMap.get(componentId);
    if (!schema) return;
    setDraftEntry((previous) => addRepeatableStructuredItem(previous, fieldKey, { ...schema, $id: componentId }, true));
  };

  const handleRemoveBlock = (fieldKey: string, index: number) => {
    setDraftEntry((previous) => removeIndexedStructuredItem(previous, fieldKey, index));
  };

  const handleDuplicateBlock = (fieldKey: string, index: number) => {
    setDraftEntry((previous) => duplicateIndexedStructuredItem(previous, fieldKey, index));
  };

  const handleReorderBlock = (fieldKey: string, fromIndex: number, targetIndex: number) => {
    setDraftEntry((previous) => reorderIndexedStructuredItem(previous, fieldKey, fromIndex, targetIndex));
  };

  const handleArrayItemChange = (fieldKey: string, index: number, value: unknown) => {
    setDraftEntry((previous) => patchArrayItem(previous, fieldKey, index, value));
  };

  const handleAddArrayItem = (fieldKey: string, sample?: unknown) => {
    setDraftEntry((previous) => addArrayItem(previous, fieldKey, sample));
  };

  const handleRemoveArrayItem = (fieldKey: string, index: number) => {
    setDraftEntry((previous) => removeIndexedStructuredItem(previous, fieldKey, index));
  };

  const handleDuplicateArrayItem = (fieldKey: string, index: number) => {
    setDraftEntry((previous) => duplicateArrayItem(previous, fieldKey, index));
  };

  const handleReorderArrayFieldItem = (fieldKey: string, fromIndex: number, targetIndex: number) => {
    setDraftEntry((previous) => reorderIndexedStructuredItem(previous, fieldKey, fromIndex, targetIndex));
  };

  const toggleStructuredItemCollapsed = (item: StructuredDragItem) => {
    const key = getStructuredItemKey(item);
    setCollapsedStructuredItems((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  const handleStructuredItemDrop = (target: StructuredDragItem) => {
    if (!draggedStructuredItem || draggedStructuredItem.kind !== target.kind || draggedStructuredItem.fieldKey !== target.fieldKey || draggedStructuredItem.index === target.index) {
      return;
    }
    if (target.kind === 'component') {
      handleReorderRepeatableComponent(target.fieldKey, draggedStructuredItem.index, target.index);
    } else if (target.kind === 'blocks') {
      handleReorderBlock(target.fieldKey, draggedStructuredItem.index, target.index);
    } else {
      handleReorderArrayFieldItem(target.fieldKey, draggedStructuredItem.index, target.index);
    }
  };

  const structuredValidationCount = useMemo(
    () => getStructuredValidationCount({ componentSchemaMap, draftEntry, editorFields }),
    [draftEntry, editorFields, componentSchemaMap],
  );

  const dragContext = createStructuredDragContext({
    draggedStructuredItem,
    dropStructuredItem,
    setDraggedStructuredItem,
    setDropStructuredItem,
    onDrop: handleStructuredItemDrop,
  });

  const fieldRendererContext = buildStructuredFieldRendererContext({
    assetMap,
    assetOptions,
    assetsLoading,
    baselineEntry,
    canUpdateEntries,
    collapsedStructuredItems,
    componentSchemaMap,
    customFieldChoices,
    draftEntry,
    dragContext,
    editorFields,
    onCustomFieldChoice: (fieldKey: string, values: string[]) => {
      setCustomFieldChoices((previous) => ({ ...previous, [fieldKey]: values }));
    },
    onOpenAssetPicker: handleOpenAssetPicker,
    relationLabelMapByField,
    relationOptionsByField,
    structuredActions: {
      addRepeatableComponent: handleAddRepeatableComponent,
      removeRepeatableComponent: handleRemoveRepeatableComponent,
      duplicateRepeatableComponent: handleDuplicateRepeatableComponent,
      updateRepeatableComponentField: handleRepeatableComponentFieldChange,
      updateComponentField: handleComponentFieldChange,
      updateObjectField: handleObjectFieldChange,
      addBlock: handleAddBlock,
      removeBlock: handleRemoveBlock,
      duplicateBlock: handleDuplicateBlock,
      updateBlockField: handleBlockFieldChange,
      addArrayItem: handleAddArrayItem,
      removeArrayItem: handleRemoveArrayItem,
      duplicateArrayItem: handleDuplicateArrayItem,
      updateArrayItem: handleArrayItemChange,
      toggleStructuredItemCollapsed,
    },
    toggleStructuredItemCollapsed,
  });

  return {
    customFieldChoices,
    setCustomFieldChoices,
    assetPickerOpened,
    setAssetPickerOpened,
    activeAssetFieldKey,
    setActiveAssetFieldKey,
    assetPickerScope,
    setAssetPickerScope,
    assetSearch,
    setAssetSearch,
    assetTagFilter,
    setAssetTagFilter,
    assetTagOptions,
    filteredAssets,
    structuredValidationCount,
    activeAssetField,
    selectedAssetReference,
    selectedAsset,
    handleSelectAsset,
    fieldRendererContext,
  };
}
