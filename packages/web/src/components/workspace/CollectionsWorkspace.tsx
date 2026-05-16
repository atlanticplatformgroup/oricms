import { Alert } from '@mantine/core';
import type { CollectionConfig, CollectionEntry, ContentType, SchemaField } from '@ori/shared';
import type { ReactNode } from 'react';
import { CollectionsBrowseView } from './collections/CollectionsBrowseView';
import { CollectionsEditorView } from './collections/CollectionsEditorView';
import { CollectionsHistoryView } from './collections/CollectionsHistoryView';
import { CollectionsSettingsView } from './collections/CollectionsSettingsView';
import type { CollectionBrowseController } from './collections/types';

interface CollectionsWorkspaceProps {
  emptySecondaryId: string;
  selectedCollection: CollectionConfig | null;
  activeEntryId: string | null;
  activeHistoryView: boolean;
  activeCollectionSettingsView: boolean;
  browse: CollectionBrowseController;
  contentTypes: ContentType[];
  canCreateEntries: boolean;
  canUpdateEntries: boolean;
  canDeleteEntries: boolean;
  canUpdateCollections: boolean;
  canDeleteCollections: boolean;
  updateCollectionsConfigPending: boolean;
  selectedEntry: CollectionEntry | null;
  selectedEntryLoading: boolean;
  selectedEntryError: boolean;
  primaryField: string;
  currentBranchName: string;
  canOpenBranchTransfer: boolean;
  onRetrySelectedEntry: () => void;
  onSelectEntry: (entryId: string) => void;
  onGoToCollectionSettings: () => void;
  onBackToCollection: () => void;
  onGoToHistory: () => void;
  onOpenBranchTransfer: () => void;
  onBackToEditor: () => void;
  renderReadonlyFieldValue: (value: unknown, field?: SchemaField, context?: { relationLabels?: Record<string, string> }) => ReactNode;
}

export function CollectionsWorkspace(props: CollectionsWorkspaceProps) {
  if (!props.selectedCollection || props.selectedCollection.id === props.emptySecondaryId) {
    return (
      <Alert color="yellow" title="No collections found">
        Configure at least one collection to begin editing content.
      </Alert>
    );
  }

  if (!props.activeEntryId) {
    if (props.activeCollectionSettingsView) {
      return (
        <CollectionsSettingsView
          selectedCollection={props.selectedCollection}
          contentTypes={props.contentTypes}
          canUpdateCollections={props.canUpdateCollections}
          canDeleteCollections={props.canDeleteCollections}
          loading={props.updateCollectionsConfigPending}
          onBackToCollection={props.onBackToCollection}
        />
      );
    }
    return (
      <CollectionsBrowseView
        selectedCollection={props.selectedCollection}
        contentTypes={props.contentTypes}
        browse={props.browse}
        canUpdateCollections={props.canUpdateCollections}
        canDeleteCollections={props.canDeleteCollections}
        onGoToCollectionSettings={props.onGoToCollectionSettings}
        onSelectEntry={props.onSelectEntry}
        canCreateEntries={props.canCreateEntries}
      />
    );
  }

  if (props.activeHistoryView) {
    return (
      <CollectionsHistoryView
        selectedCollection={props.selectedCollection}
        canUpdateEntries={props.canUpdateEntries}
        onBackToEditor={props.onBackToEditor}
        renderReadonlyFieldValue={props.renderReadonlyFieldValue}
      />
    );
  }

  return (
    <CollectionsEditorView
      selectedEntry={props.selectedEntry}
      selectedCollection={props.selectedCollection}
      primaryField={props.primaryField}
      activeHistoryView={props.activeHistoryView}
      canUpdateEntries={props.canUpdateEntries}
      canDeleteEntries={props.canDeleteEntries}
      selectedEntryLoading={props.selectedEntryLoading}
      onGoToHistory={props.onGoToHistory}
      onOpenBranchTransfer={props.onOpenBranchTransfer}
      selectedEntryError={props.selectedEntryError}
      onRetrySelectedEntry={props.onRetrySelectedEntry}
      currentBranchName={props.currentBranchName}
      canOpenBranchTransfer={props.canOpenBranchTransfer}
    />
  );
}
