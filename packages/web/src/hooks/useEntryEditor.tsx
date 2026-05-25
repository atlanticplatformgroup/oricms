import { useMemo, useRef, useState } from 'react';
import type { Asset, ComponentSchema, CollectionConfig, CollectionEntry, ContentType } from '@ori/shared';
import type { QueryClient } from '@tanstack/react-query';
import { resolveEditorSections } from '../lib/entries/editor';
import { getEditorFields } from '../lib/entries/resolution';
import { createFieldDiffs, stripSystemFields } from '../lib/entries/transforms';
import { isSchemaFieldVisible } from '@ori/shared';
import { useEntryRelations } from './useEntryRelations';
import { useEntryStructuredEditing } from './useEntryStructuredEditing';
import type { GlobalAsset } from '../lib/assets/references';
import { useEntryPersistence } from './useEntryPersistence';
import { buildDerivedIdentifierConfig, buildEditorFieldErrors, type IdentifierState } from './entryEditorSupport';
import {
  buildIdentifierResetHandler,
  createEntryFieldChangeHandler,
  useDirtyEntryUnloadPrompt,
  useEntrySaveShortcut,
  useEntrySelectionSync,
  useIdentifierStateSync,
} from './entryEditorEffects';

interface UseEntryEditorOptions {
  projectId: string | null;
  selectedCollection: CollectionConfig | null;
  selectedContentType: ContentType | null;
  selectedEntry: CollectionEntry | null;
  selectedEntryRevision: string | null;
  entries: CollectionEntry[];
  primaryField: string;
  collections: CollectionConfig[];
  contentTypes: ContentType[];
  componentSchemaMap: Map<string, ComponentSchema>;
  assetOptions: Array<{ value: string; label: string }>;
  assetMap: Map<string, Asset>;
  assetsLoading: boolean;
  assetRecords: Asset[];
  globalAssetRecords: GlobalAsset[];
  canCreateEntries: boolean;
  canUpdateEntries: boolean;
  canDeleteEntries: boolean;
  showToast: (message: string, tone?: 'success' | 'error' | 'info') => void;
  queryClient: QueryClient;
  onNavigateToEntry: (entryId: string) => void;
  onNavigateToCollection: () => void;
}

export function useEntryEditor({
  projectId,
  selectedCollection,
  selectedContentType,
  selectedEntry,
  selectedEntryRevision,
  entries,
  primaryField,
  collections,
  contentTypes,
  componentSchemaMap,
  assetOptions,
  assetMap,
  assetsLoading,
  assetRecords,
  globalAssetRecords,
  canCreateEntries,
  canUpdateEntries,
  canDeleteEntries,
  showToast,
  queryClient,
  onNavigateToEntry,
  onNavigateToCollection,
}: UseEntryEditorOptions) {
  const [draftEntry, setDraftEntry] = useState<CollectionEntry | null>(null);
  const [baselineEntry, setBaselineEntry] = useState<CollectionEntry | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [showCommitBar, setShowCommitBar] = useState(false);
  const [identifierStateByField, setIdentifierStateByField] = useState<IdentifierState>({});
  const [currentRevision, setCurrentRevision] = useState<string | null>(selectedEntryRevision);
  const lastSyncedEntryIdRef = useRef<string | null>(null);
  const lastSyncedIdentifierEntryIdRef = useRef<string | null>(null);

  const editorFields = useMemo(
    () => getEditorFields(selectedContentType, draftEntry ?? selectedEntry),
    [selectedContentType, draftEntry, selectedEntry],
  );

  const editorFieldMap = useMemo(
    () => new Map(editorFields.map((field) => [field.key, field])),
    [editorFields],
  );

  const visibleEditorFields = useMemo(
    () => editorFields.filter((field) => isSchemaFieldVisible(field, (draftEntry ?? selectedEntry ?? {}) as Record<string, unknown>)),
    [editorFields, draftEntry, selectedEntry],
  );

  const editorSections = useMemo(
    () => resolveEditorSections(selectedContentType, visibleEditorFields),
    [selectedContentType, visibleEditorFields],
  );

  const derivedIdentifierConfig = useMemo(() => {
    return buildDerivedIdentifierConfig(editorFields, editorFieldMap);
  }, [editorFields, editorFieldMap]);

  const editorFieldErrors = useMemo(() => {
    return buildEditorFieldErrors(draftEntry, visibleEditorFields);
  }, [draftEntry, visibleEditorFields]);

  const isDirty = useMemo(() => {
    if (!draftEntry || !baselineEntry) return false;
    return JSON.stringify(stripSystemFields(draftEntry)) !== JSON.stringify(stripSystemFields(baselineEntry));
  }, [baselineEntry, draftEntry]);

  const entryFieldDiffs = useMemo(() => {
    if (!draftEntry || !baselineEntry) return [];
    return createFieldDiffs(stripSystemFields(baselineEntry), stripSystemFields(draftEntry));
  }, [baselineEntry, draftEntry]);

  const changedFieldCount = entryFieldDiffs.length;
  const entryStatusChanged = (baselineEntry?.$status || 'draft') !== (draftEntry?.$status || 'draft');

  useEntrySelectionSync({
    isDirty,
    lastSyncedEntryIdRef,
    selectedEntry,
    selectedEntryRevision,
    setBaselineEntry,
    setCommitMessage,
    setCurrentRevision,
    setDraftEntry,
    setIdentifierStateByField,
    setShowCommitBar,
  });

  useIdentifierStateSync({
    derivedIdentifierConfig,
    isDirty,
    lastSyncedIdentifierEntryIdRef,
    selectedEntry,
    setIdentifierStateByField,
  });

  useDirtyEntryUnloadPrompt(isDirty);

  const handleFieldChange = createEntryFieldChangeHandler({
    derivedIdentifierConfig,
    editorFields,
    identifierStateByField,
    setDraftEntry,
    setIdentifierStateByField,
  });

  const {
    relationOptionsByField,
    relationLabelMapByField,
    relationPickerOpened,
    setRelationPickerOpened,
    activeRelationField,
    activeRelationFieldKey,
    setActiveRelationFieldKey,
    relationSearch,
    setRelationSearch,
    relationPickerResults,
    relationPickerLoading,
    activeSelectedRelationIds,
    activeSelectedRelationOptions,
    activeRelationCollection,
    activeRelationMultiple,
    openRelationPicker,
  } = useEntryRelations({
    projectId,
    visibleEditorFields,
    collections,
    contentTypes,
    draftEntry,
  });

  const structuredEditing = useEntryStructuredEditing({
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
  });

  const {
    createEntryMutation,
    deleteEntryMutation,
    handleCommitEntry,
    handleDeleteEntry,
    handleNewEntry,
    handleRestoreVersion,
    handleSaveEntry,
    updateEntryMutation,
  } = useEntryPersistence({
    canCreateEntries,
    canDeleteEntries,
    canUpdateEntries,
    commitMessage,
    currentRevision,
    draftEntry,
    editorValidationCount: Object.keys(editorFieldErrors).length + structuredEditing.structuredValidationCount,
    entries,
    isDirty,
    onNavigateToCollection,
    onNavigateToEntry,
    primaryField,
    projectId,
    queryClient,
    selectedCollection,
    selectedEntry,
    setBaselineEntry,
    setCommitMessage,
    setCurrentRevision,
    setDraftEntry,
    setShowCommitBar,
    showToast,
  });

  const handleResetIdentifierToAuto = buildIdentifierResetHandler({
    derivedIdentifierConfig,
    draftEntry,
    setDraftEntry,
    setIdentifierStateByField,
  });

  const editorValidationCount = Object.keys(editorFieldErrors).length + structuredEditing.structuredValidationCount;

  useEntrySaveShortcut({
    canUpdateEntries,
    handleSaveEntry,
    selectedEntryId: selectedEntry?.$id,
    showCommitBar,
  });

  return {
    draftEntry,
    baselineEntry,
    commitMessage,
    setCommitMessage,
    showCommitBar,
    setShowCommitBar,
    relationOptionsByField,
    relationLabelMapByField,
    relationPickerOpened,
    setRelationPickerOpened,
    activeRelationField,
    activeRelationFieldKey,
    setActiveRelationFieldKey,
    relationSearch,
    setRelationSearch,
    relationPickerResults,
    relationPickerLoading,
    activeSelectedRelationIds,
    activeSelectedRelationOptions,
    activeRelationCollection,
    activeRelationMultiple,
    assetPickerOpened: structuredEditing.assetPickerOpened,
    setAssetPickerOpened: structuredEditing.setAssetPickerOpened,
    activeAssetFieldKey: structuredEditing.activeAssetFieldKey,
    setActiveAssetFieldKey: structuredEditing.setActiveAssetFieldKey,
    assetPickerScope: structuredEditing.assetPickerScope,
    setAssetPickerScope: structuredEditing.setAssetPickerScope,
    assetSearch: structuredEditing.assetSearch,
    setAssetSearch: structuredEditing.setAssetSearch,
    filteredAssets: structuredEditing.filteredAssets,
    assetTagFilter: structuredEditing.assetTagFilter,
    setAssetTagFilter: structuredEditing.setAssetTagFilter,
    assetTagOptions: structuredEditing.assetTagOptions,
    activeAssetField: structuredEditing.activeAssetField,
    selectedAssetReference: structuredEditing.selectedAssetReference,
    selectedAsset: structuredEditing.selectedAsset,
    isDirty,
    editorFields,
    editorFieldMap,
    editorSections,
    editorFieldErrors,
    editorValidationCount,
    changedFieldCount,
    entryStatusChanged,
    createEntryPending: createEntryMutation.isPending,
    updateEntryPending: updateEntryMutation.isPending,
    deleteEntryPending: deleteEntryMutation.isPending,
    currentRevision,
    handleFieldChange,
    handleNewEntry,
    handleDeleteEntry,
    handleSaveEntry,
    handleCommitEntry,
    handleRestoreVersion,
    handleSelectAsset: structuredEditing.handleSelectAsset,
    fieldRendererContext: {
      ...structuredEditing.fieldRendererContext,
      onOpenRelationPicker: openRelationPicker,
      relationPickerResults,
      activeSelectedRelationOptions,
      identifierStateByField,
      onResetIdentifierToAuto: handleResetIdentifierToAuto,
    },
  };
}
