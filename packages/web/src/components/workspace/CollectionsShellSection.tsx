import { Button } from '@mantine/core';
import type { ReactNode } from 'react';
import type { CollectionConfig, CollectionEntry, ContentType, SchemaField } from '@ori/shared';
import { useCollectionManagerContext } from '../../contexts/workspace/CollectionManagerContext';
import { useEditorContext } from '../../contexts/workspace/EditorContext';
import { useEntryHistoryContext } from '../../contexts/workspace/EntryHistoryContext';
import { useProject } from '../../contexts/useProject';
import { AssetPickerModal } from './modals/AssetPickerModal';
import { CreateCollectionModal } from './modals/CreateCollectionModal';
import { EntryBranchTransferModal } from './modals/EntryBranchTransferModal';
import { RelationPickerModal } from './modals/RelationPickerModal';
import { RestoreConfirmModal } from './modals/RestoreConfirmModal';
import { CollectionsWorkspace } from './CollectionsWorkspace';
import type { CollectionBrowseController } from './collections/types';
import { useEntryBranchTransfer } from '../../hooks/useEntryBranchTransfer';

export function CollectionsSidebarAction() {
  const collectionManager = useCollectionManagerContext();
  return <Button size="xs" variant="subtle" onClick={collectionManager.openCreateCollection}>New collection</Button>;
}

export function AssetPickerModalMount(props: { loading: boolean }) {
  const entryEditor = useEditorContext();
  return (
    <AssetPickerModal
      opened={entryEditor.assetPickerOpened}
      onClose={() => {
        entryEditor.setAssetPickerOpened(false);
        entryEditor.setActiveAssetFieldKey(null);
        entryEditor.setAssetSearch('');
      }}
      activeAssetFieldLabel={entryEditor.activeAssetField?.label}
      assetSource={entryEditor.assetPickerScope}
      onAssetSourceChange={entryEditor.setAssetPickerScope}
      selectedAssetReference={entryEditor.selectedAssetReference}
      selectedAsset={entryEditor.selectedAsset}
      filteredAssets={entryEditor.filteredAssets}
      assetSearch={entryEditor.assetSearch}
      onAssetSearchChange={entryEditor.setAssetSearch}
      assetTagFilter={entryEditor.assetTagFilter}
      assetTagOptions={entryEditor.assetTagOptions}
      onAssetTagFilterChange={entryEditor.setAssetTagFilter}
      onSelectAsset={entryEditor.handleSelectAsset}
      loading={props.loading}
    />
  );
}

export function RelationPickerModalMount() {
  const entryEditor = useEditorContext();

  return (
    <RelationPickerModal
      opened={entryEditor.relationPickerOpened}
      onClose={() => {
        entryEditor.setRelationPickerOpened(false);
        entryEditor.setActiveRelationFieldKey(null);
        entryEditor.setRelationSearch('');
      }}
      fieldLabel={entryEditor.activeRelationField?.label}
      collectionLabel={entryEditor.activeRelationCollection?.label}
      multiple={entryEditor.activeRelationMultiple}
      search={entryEditor.relationSearch}
      onSearchChange={entryEditor.setRelationSearch}
      loading={entryEditor.relationPickerLoading}
      options={entryEditor.relationPickerResults}
      selectedValues={entryEditor.activeSelectedRelationIds}
      onSelect={(nextValue) => {
        if (!entryEditor.activeRelationFieldKey) return;
        entryEditor.handleFieldChange(entryEditor.activeRelationFieldKey, nextValue);
      }}
    />
  );
}

export function CollectionModalsMount(props: { contentTypes: ContentType[]; createLoading: boolean }) {
  const collectionManager = useCollectionManagerContext();
  return (
    <>
      <CreateCollectionModal
        opened={collectionManager.createCollectionOpened}
        onClose={() => collectionManager.setCreateCollectionOpened(false)}
        newCollection={collectionManager.newCollection}
        setNewCollection={collectionManager.setNewCollection}
        contentTypes={props.contentTypes}
        pathError={collectionManager.newCollectionPathError}
        loading={props.createLoading}
        onCreate={() => void collectionManager.handleCreateCollection()}
      />
    </>
  );
}

export function RestoreConfirmModalMount(props: { currentBranchName: string }) {
  const history = useEntryHistoryContext();
  return (
    <RestoreConfirmModal
      opened={history.restoreConfirmOpened}
      onClose={history.closeRestoreConfirm}
      currentBranchName={props.currentBranchName}
      selectedHistoryHash={history.selectedHistoryItem?.hash}
      selectedHistoryMessage={history.selectedHistoryItem?.message ?? null}
      loading={history.restorePending}
      disabled={!history.selectedHistoryVersionData || history.historyFieldDiffs.length === 0}
      onConfirm={() => void history.handleRestoreSelectedRevision()}
    />
  );
}

interface CollectionsSectionProps {
  emptySecondaryId: string;
  selectedCollection: CollectionConfig | null;
  activeEntryId: string | null;
  activeHistoryView: boolean;
  activeCollectionSettingsView: boolean;
  selectedEntry: CollectionEntry | null;
  primaryField: string;
  secondaryField?: string | null;
  browse: CollectionBrowseController;
  canCreateEntries: boolean;
  canUpdateEntries: boolean;
  canDeleteEntries: boolean;
  canUpdateCollections: boolean;
  canDeleteCollections: boolean;
  contentTypes: ContentType[];
  updateCollectionsConfigPending: boolean;
  selectedEntryLoading: boolean;
  selectedEntryError: boolean;
  onRetrySelectedEntry: () => void;
  onSelectEntry: (entryId: string) => void;
  onBackToCollection: () => void;
  onGoToCollectionSettings: () => void;
  onGoToHistory: () => void;
  onBackToEditor: () => void;
  renderReadonlyFieldValue: (value: unknown, field?: SchemaField, context?: { relationLabels?: Record<string, string> }) => ReactNode;
  currentBranchName: string;
}

export function CollectionsSection(props: CollectionsSectionProps) {
  const { currentProject } = useProject();
  const branchTransfer = useEntryBranchTransfer({
    projectId: currentProject?.id ?? null,
    selectedCollection: props.selectedCollection,
    selectedEntry: props.selectedEntry,
    currentBranchName: props.currentBranchName,
    canUpdateEntries: props.canUpdateEntries,
  });

  return (
    <>
      <CollectionsWorkspace
        emptySecondaryId={props.emptySecondaryId}
        selectedCollection={props.selectedCollection}
        activeEntryId={props.activeEntryId}
        activeHistoryView={props.activeHistoryView}
        activeCollectionSettingsView={props.activeCollectionSettingsView}
        selectedEntry={props.selectedEntry}
        primaryField={props.primaryField}
        browse={props.browse}
        canCreateEntries={props.canCreateEntries}
        canUpdateEntries={props.canUpdateEntries}
        canDeleteEntries={props.canDeleteEntries}
        canUpdateCollections={props.canUpdateCollections}
        canDeleteCollections={props.canDeleteCollections}
        updateCollectionsConfigPending={props.updateCollectionsConfigPending}
        selectedEntryLoading={props.selectedEntryLoading}
        selectedEntryError={props.selectedEntryError}
        onRetrySelectedEntry={props.onRetrySelectedEntry}
        onSelectEntry={props.onSelectEntry}
        onGoToCollectionSettings={props.onGoToCollectionSettings}
        onBackToCollection={props.onBackToCollection}
        contentTypes={props.contentTypes}
        onGoToHistory={props.onGoToHistory}
        onOpenBranchTransfer={() => branchTransfer.setOpened(true)}
        onBackToEditor={props.onBackToEditor}
        renderReadonlyFieldValue={props.renderReadonlyFieldValue}
        currentBranchName={props.currentBranchName}
        canOpenBranchTransfer={branchTransfer.canOpen}
      />
      <EntryBranchTransferModal
        opened={branchTransfer.opened}
        onClose={() => branchTransfer.setOpened(false)}
        fromBranch={props.currentBranchName}
        branchOptions={branchTransfer.branchOptions}
        branchesLoading={branchTransfer.branchesLoading}
        targetBranch={branchTransfer.targetBranch}
        onTargetBranchChange={branchTransfer.setTargetBranch}
        mode={branchTransfer.mode}
        onModeChange={branchTransfer.setMode}
        message={branchTransfer.message}
        onMessageChange={branchTransfer.setMessage}
        preview={branchTransfer.preview}
        previewLoading={branchTransfer.previewLoading}
        previewError={branchTransfer.previewError}
        onRetryPreview={branchTransfer.retryPreview}
        selectedPointers={branchTransfer.selectedPointers}
        onSelectedPointersChange={branchTransfer.setSelectedPointers}
        resolutions={branchTransfer.resolutions}
        onResolutionChange={branchTransfer.setResolution}
        applyPending={branchTransfer.applyPending}
        canApply={branchTransfer.canApply}
        onApply={branchTransfer.applyTransfer}
      />
    </>
  );
}
