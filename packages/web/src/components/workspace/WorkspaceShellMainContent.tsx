import { Suspense } from 'react';
import { Center, Loader } from '@mantine/core';
import { EMPTY_SECONDARY } from '../../lib/workspace/constants';
import { buildWorkspacePath } from '../../lib/workspace/routing';
import { WorkspaceFeatureBoundary } from '../error/WorkspaceFeatureBoundary';
import { AssetPickerModalMount, CollectionModalsMount, CollectionsSection, RelationPickerModalMount, RestoreConfirmModalMount } from './CollectionsShellSection';
import { CreateSchemaModal } from './modals/CreateSchemaModal';
import { PlaceholderWorkspace } from './PlaceholderWorkspace';
import { SchemaDeleteModal } from './schema/SchemaDeleteModal';
import { SchemaHistoryModal } from './schema/SchemaHistoryModal';
import { SchemaJsonModal } from './schema/SchemaJsonModal';
import { SchemasWorkspace } from './SchemasWorkspace';
import { MediaWorkspace } from './MediaWorkspace';
import { BuildsWorkspace } from './BuildsWorkspace';
import { MembersWorkspace } from './MembersWorkspace';
import { SettingsWorkspace } from './SettingsWorkspace';
import { useSchemaEditorContext } from '../../contexts/workspace/SchemaEditorContext';
import { SCHEMA_FIELD_TYPE_GROUPS, SCHEMA_FIELD_TYPE_OPTIONS } from '../../lib/workspace/constants';
import { toLabel } from '../../lib/workspace/format';
import { makeSchemaField } from '../../lib/schemas/factory';
import type { AppShellLayoutProps } from './WorkspaceShellLayout.types';

function SchemasSection(props: {
  activeSchemaMode: 'types' | 'components';
  selectedSchemaDocument: AppShellLayoutProps['selectedSchemaDocument'];
  componentSchemaOptions: Array<{ value: string; label: string }>;
  collectionOptions: Array<{ value: string; label: string }>;
}) {
  const schemaEditor = useSchemaEditorContext();
  return (
    <SchemasWorkspace
      activeSchemaMode={props.activeSchemaMode}
      onCreateSchema={() => schemaEditor.setCreateSchemaOpened(true)}
      onSaveSchema={() => void schemaEditor.handleSaveSchema()}
      onOpenDeleteSchema={() => schemaEditor.setDeleteSchemaOpened(true)}
      onOpenSchemaJson={() => schemaEditor.setSchemaJsonOpened(true)}
      onOpenSchemaHistory={() => schemaEditor.setSchemaHistoryOpened(true)}
      canDeleteSchema={Boolean(props.selectedSchemaDocument)}
      canSaveSchema={schemaEditor.canSaveSchema}
      isSchemaDirty={schemaEditor.isSchemaDirty}
      saveSchemaPending={schemaEditor.saveSchemaPending}
      selectedSchemaDocument={props.selectedSchemaDocument}
      effectiveSchema={schemaEditor.effectiveSchema}
      effectiveSchemaFields={schemaEditor.effectiveSchemaFields}
      schemaIssues={schemaEditor.schemaValidation.schemaIssues}
      fieldIssuesByKey={schemaEditor.schemaValidation.fieldIssuesByKey}
      validationIssueCount={schemaEditor.schemaValidation.issueCount}
      newFieldGuidance={schemaEditor.newFieldGuidance}
      schemaBusy={schemaEditor.schemaLock.isPending || schemaEditor.saveSchemaPending || schemaEditor.deleteSchemaPending}
      schemaBlockingLock={schemaEditor.schemaLock.blockingLock}
      schemaLockError={schemaEditor.schemaLock.error}
      onSchemaMetaChange={schemaEditor.handleSchemaMetaChange}
      newSchemaFieldType={schemaEditor.newSchemaFieldType}
      onNewSchemaFieldTypeChange={schemaEditor.setNewSchemaFieldType}
      onAddSchemaField={schemaEditor.handleAddSchemaField}
      onReorderSchemaField={schemaEditor.handleReorderSchemaField}
      onSchemaFieldPatch={schemaEditor.handleSchemaFieldPatch}
      onRemoveSchemaField={schemaEditor.handleRemoveSchemaField}
      componentSchemaOptions={props.componentSchemaOptions}
      collectionOptions={props.collectionOptions}
      schemaFieldTypeOptions={SCHEMA_FIELD_TYPE_OPTIONS}
      schemaFieldTypeGroups={SCHEMA_FIELD_TYPE_GROUPS}
      toLabel={toLabel}
      makeSchemaField={makeSchemaField}
    />
  );
}

function CreateSchemaModalMount(props: { activeSchemaMode: 'types' | 'components' }) {
  const schemaEditor = useSchemaEditorContext();
  return (
    <CreateSchemaModal
      opened={schemaEditor.createSchemaOpened}
      onClose={() => schemaEditor.setCreateSchemaOpened(false)}
      mode={props.activeSchemaMode}
      name={schemaEditor.newSchemaName}
      setName={schemaEditor.setNewSchemaName}
      label={schemaEditor.newSchemaLabel}
      setLabel={schemaEditor.setNewSchemaLabel}
      description={schemaEditor.newSchemaDescription}
      setDescription={schemaEditor.setNewSchemaDescription}
      loading={schemaEditor.saveSchemaPending}
      onCreate={() => void schemaEditor.handleCreateSchema()}
    />
  );
}

function SchemaToolModalsMount(props: { activeSchemaMode: 'types' | 'components' }) {
  const schemaEditor = useSchemaEditorContext();
  return (
    <>
      <SchemaDeleteModal
        opened={schemaEditor.deleteSchemaOpened}
        onClose={() => schemaEditor.setDeleteSchemaOpened(false)}
        label={schemaEditor.effectiveSchema?.label || schemaEditor.effectiveSchema?.name || schemaEditor.effectiveSchema?.$id || 'schema'}
        mode={props.activeSchemaMode}
        loading={schemaEditor.deleteSchemaPending}
        onConfirm={() => void schemaEditor.handleDeleteSchema()}
      />
      <SchemaJsonModal
        opened={schemaEditor.schemaJsonOpened}
        onClose={() => schemaEditor.setSchemaJsonOpened(false)}
        json={schemaEditor.schemaJson}
      />
      <SchemaHistoryModal
        opened={schemaEditor.schemaHistoryOpened}
        onClose={() => schemaEditor.setSchemaHistoryOpened(false)}
        loading={schemaEditor.schemaHistoryLoading}
        history={schemaEditor.schemaHistory}
      />
    </>
  );
}

export function WorkspaceShellMainContent(props: {
  layout: AppShellLayoutProps;
  guardedNavigate: (to: string, replace?: boolean) => void;
  handleSelectEntry: (entryId: string) => void;
}) {
  const { layout } = props;

  return (
    <>
      <Suspense fallback={<Center py="xl"><Loader size="sm" /></Center>}>
        {layout.activeSection === 'collections' ? (
          <WorkspaceFeatureBoundary title={layout.activeEntryId ? 'Entry editor' : layout.activeCollectionSettingsView ? 'Schema settings' : 'Entries'}>
            <CollectionsSection
              emptySecondaryId={EMPTY_SECONDARY}
              selectedCollection={layout.selectedCollection}
              activeEntryId={layout.activeEntryId}
              activeHistoryView={layout.activeHistoryView}
              activeCollectionSettingsView={layout.activeCollectionSettingsView}
              selectedEntry={layout.selectedEntry}
              primaryField={layout.primaryField}
              secondaryField={layout.secondaryField || undefined}
              browse={layout.collectionBrowse}
              canCreateEntries={layout.canCreateEntries}
              canUpdateEntries={layout.canUpdateEntries}
              canDeleteEntries={layout.canDeleteEntries}
              canUpdateCollections={layout.canUpdateCollections}
              canDeleteCollections={layout.canDeleteCollections}
              contentTypes={layout.contentTypes}
              updateCollectionsConfigPending={layout.updateCollectionsConfigPending}
              selectedEntryLoading={layout.selectedEntryLoading}
              selectedEntryError={layout.selectedEntryError}
              onRetrySelectedEntry={layout.retrySelectedEntry}
              onSelectEntry={props.handleSelectEntry}
              onBackToCollection={() => {
                if (!layout.activeProjectSlug || !layout.selectedCollection) return;
                props.guardedNavigate(buildWorkspacePath(layout.activeProjectSlug, 'collections', layout.selectedCollection.id, { branchName: layout.currentBranchName }));
              }}
              onGoToCollectionSettings={() => {
                if (!layout.activeProjectSlug || !layout.selectedCollection) return;
                props.guardedNavigate(buildWorkspacePath(layout.activeProjectSlug, 'collections', layout.selectedCollection.id, { collectionSettingsView: true, branchName: layout.currentBranchName }));
              }}
              onGoToHistory={() => {
                if (!layout.activeProjectSlug || !layout.selectedCollection || !layout.selectedEntry) return;
                props.guardedNavigate(buildWorkspacePath(layout.activeProjectSlug, 'collections', layout.selectedCollection.id, { entryId: layout.selectedEntry.$id, historyView: true, branchName: layout.currentBranchName }));
              }}
              onBackToEditor={() => {
                if (!layout.activeProjectSlug || !layout.selectedCollection || !layout.selectedEntry) return;
                props.guardedNavigate(buildWorkspacePath(layout.activeProjectSlug, 'collections', layout.selectedCollection.id, { entryId: layout.selectedEntry.$id, branchName: layout.currentBranchName }));
              }}
              renderReadonlyFieldValue={layout.renderReadonlyFieldValue}
              currentBranchName={layout.currentBranchName}
            />
          </WorkspaceFeatureBoundary>
        ) : layout.activeSection === 'schemas' ? (
          <SchemasSection
            activeSchemaMode={layout.activeSchemaMode}
            selectedSchemaDocument={layout.selectedSchemaDocument}
            componentSchemaOptions={layout.componentSchemaData.map((item) => ({ value: item.schema.$id, label: item.schema.label || item.schema.name || item.schema.$id }))}
            collectionOptions={layout.collections.map((collection) => ({ value: collection.id, label: `${collection.label} · ${collection.id}` }))}
          />
        ) : layout.activeSection === 'media' ? (
          <MediaWorkspace
            projectId={layout.currentProject.id}
            selectedView={layout.selectedSecondaryOption?.id || 'all-assets'}
            selectedLabel={layout.selectedSecondaryOption?.label}
            selectedDescription={layout.selectedSecondaryOption?.description}
            canCreateAssets={layout.canCreateAssets}
            canUpdateAssets={layout.canUpdateAssets}
            canDeleteAssets={layout.canDeleteAssets}
            showToast={layout.showToast}
          />
        ) : layout.activeSection === 'builds' ? (
          <BuildsWorkspace
            projectId={layout.currentProject.id}
            selectedView={layout.selectedSecondaryOption?.id || 'recent'}
            selectedLabel={layout.selectedSecondaryOption?.label}
            selectedDescription={layout.selectedSecondaryOption?.description}
            currentBranch={layout.currentBranchName}
            onSelectView={(view) => {
              if (!layout.activeProjectSlug) return;
              props.guardedNavigate(buildWorkspacePath(layout.activeProjectSlug, 'builds', view, { branchName: layout.currentBranchName }));
            }}
            showToast={layout.showToast}
          />
        ) : layout.activeSection === 'members' ? (
          <MembersWorkspace
            projectId={layout.currentProject.id}
            selectedView={layout.selectedSecondaryOption?.id || 'all-members'}
            selectedLabel={layout.selectedSecondaryOption?.label}
            selectedDescription={layout.selectedSecondaryOption?.description}
          />
        ) : layout.activeSection === 'settings' ? (
          <SettingsWorkspace
            projectId={layout.currentProject.id}
            currentBranchName={layout.currentBranchName}
            selectedView={layout.selectedSecondaryOption?.id || 'general'}
            canManageGlobalMedia={layout.canManageGlobalMedia}
            canCreateAssets={layout.canCreateAssets}
            canUpdateAssets={layout.canUpdateAssets}
            canDeleteAssets={layout.canDeleteAssets}
            showToast={layout.showToast}
          />
        ) : (
          <PlaceholderWorkspace
            title={layout.activeSectionLabel}
            selectedLabel={layout.selectedSecondaryOption?.label}
            selectedDescription={layout.selectedSecondaryOption?.description}
          />
        )}
      </Suspense>
      <CollectionModalsMount contentTypes={layout.contentTypes} createLoading={layout.updateCollectionsConfigPending} />
      <CreateSchemaModalMount activeSchemaMode={layout.activeSchemaMode} />
      <SchemaToolModalsMount activeSchemaMode={layout.activeSchemaMode} />
      <RestoreConfirmModalMount currentBranchName={layout.currentBranchName} />
      <RelationPickerModalMount />
      <AssetPickerModalMount loading={layout.assetsQueryLoading} />
    </>
  );
}
