import { Alert, Button, Select, Stack, Switch, Text, TextInput, Textarea } from '@mantine/core';
import type { CollectionConfig, ContentType } from '@ori/shared';
import { useCollectionManagerContext } from '../../../contexts/workspace/CollectionManagerContext';
import { useProject } from '../../../contexts/useProject';
import { useWorkspaceRouterContext } from '../../../contexts/workspace/WorkspaceRouterContext';
import { useActionScopedLock } from '../../../hooks/useActionScopedLock';
import { WorkspaceFieldGrid, WorkspaceFooterBar, WorkspaceFormSection, WorkspaceHeader, WorkspaceMain, WorkspacePage, WorkspaceSection, WorkspaceToggleRow } from '../../ui/WorkspacePrimitives';

interface CollectionsSettingsViewProps {
  selectedCollection: CollectionConfig;
  contentTypes: ContentType[];
  canUpdateCollections: boolean;
  canDeleteCollections: boolean;
  loading: boolean;
  onBackToCollection: () => void;
}

export function CollectionsSettingsView({
  selectedCollection,
  contentTypes,
  canUpdateCollections,
  canDeleteCollections,
  loading,
  onBackToCollection,
}: CollectionsSettingsViewProps) {
  const collectionManager = useCollectionManagerContext();
  const { currentProject } = useProject();
  const { activeBranchName } = useWorkspaceRouterContext();
  const settingsLock = useActionScopedLock({
    projectId: currentProject?.id ?? null,
    resourceType: 'collectionConfig',
    resourceId: selectedCollection.id,
    branch: activeBranchName ?? undefined,
    mode: 'hard',
    reason: 'configuring',
  });
  const isBusy = settingsLock.isPending || loading;

  const runCollectionSettingsAction = async (action: (headers: Record<string, string>) => Promise<void>) => {
    try {
      await settingsLock.runWithLock(action);
    } catch {
      // Feedback is surfaced by the action lock state.
    }
  };

  return (
    <WorkspacePage>
      <WorkspaceHeader
        title={`${selectedCollection.label} schema settings`}
        description={selectedCollection.path}
        actions={(
          <Button variant="subtle" onClick={onBackToCollection}>
            {`Back to ${selectedCollection.label}`}
          </Button>
        )}
      />

      <WorkspaceMain>
        {settingsLock.blockingLock ? (
          <Alert color="yellow" title={settingsLock.blockingLock?.holderName ? `Locked by ${settingsLock.blockingLock.holderName}` : 'Schema locked'}>
            {settingsLock.blockingLock?.holderName
              ? `${settingsLock.blockingLock.holderName} is editing this schema configuration. Try again after their editing session ends.`
              : 'This schema configuration is currently locked for editing.'}
          </Alert>
        ) : settingsLock.error ? (
          <Alert color="red" title="Unable to edit schema settings">{settingsLock.error}</Alert>
        ) : null}
        <WorkspaceFormSection
          title="Configuration"
          description="Configure how this schema is labeled, stored, and routed."
        >
          <Stack gap="md">
            <WorkspaceFieldGrid>
              <TextInput
                label="Schema id"
                description="Stable identifier used in routes and config."
                value={collectionManager.collectionSettings.id}
                disabled={!canUpdateCollections || isBusy}
                onChange={(event) => collectionManager.setCollectionSettings((previous) => ({ ...previous, id: event.currentTarget.value }))}
              />
              <Select
                label="Content type"
                description={collectionManager.selectedCollectionEntryCount > 0 ? 'Locked after the collection has entries.' : 'Determines the content type used for entries in this schema.'}
                data={contentTypes.map((type) => ({ value: type.$id, label: type.label || type.name || type.$id }))}
                value={collectionManager.collectionSettings.contentType}
                disabled={!canUpdateCollections || collectionManager.selectedCollectionEntryCount > 0 || isBusy}
                onChange={(nextValue) => collectionManager.setCollectionSettings((previous) => ({ ...previous, contentType: nextValue || previous.contentType }))}
              />
            </WorkspaceFieldGrid>
            <WorkspaceFieldGrid>
              <TextInput
                label="Label"
                value={collectionManager.collectionSettings.label}
                disabled={!canUpdateCollections || isBusy}
                onChange={(event) => collectionManager.setCollectionSettings((previous) => ({ ...previous, label: event.currentTarget.value }))}
              />
              <TextInput
                label="Singular label"
                value={collectionManager.collectionSettings.singularLabel}
                disabled={!canUpdateCollections || isBusy}
                onChange={(event) => collectionManager.setCollectionSettings((previous) => ({ ...previous, singularLabel: event.currentTarget.value }))}
              />
            </WorkspaceFieldGrid>
            <TextInput
              label="Path"
              value={collectionManager.collectionSettings.path}
              error={collectionManager.collectionSettings.path ? collectionManager.collectionSettingsPathError || undefined : undefined}
              description="Use a repo-relative folder path like content/blog-posts."
              disabled={!canUpdateCollections || isBusy}
              onChange={(event) => collectionManager.setCollectionSettings((previous) => ({ ...previous, path: event.currentTarget.value }))}
            />
            <Textarea
              label="Description"
              autosize
              minRows={2}
              value={collectionManager.collectionSettings.description}
              disabled={!canUpdateCollections || isBusy}
              onChange={(event) => collectionManager.setCollectionSettings((previous) => ({ ...previous, description: event.currentTarget.value }))}
            />
            <WorkspaceFieldGrid>
              <WorkspaceToggleRow
                label="Enable routing"
                description="Generate route-aware slugs and URL paths from collection entries."
                control={(
                  <Switch
                    aria-label="Enable routing"
                    checked={collectionManager.collectionSettings.routingEnabled}
                    disabled={!canUpdateCollections || isBusy}
                    onChange={(event) => collectionManager.setCollectionSettings((previous) => ({ ...previous, routingEnabled: event.currentTarget.checked }))}
                  />
                )}
              />
              <TextInput
                label="Slug pattern"
                description="Use collection fields to define generated slugs when routing is enabled."
                value={collectionManager.collectionSettings.slugPattern}
                disabled={!canUpdateCollections || isBusy}
                onChange={(event) => collectionManager.setCollectionSettings((previous) => ({ ...previous, slugPattern: event.currentTarget.value }))}
              />
            </WorkspaceFieldGrid>
          </Stack>
        </WorkspaceFormSection>

        <WorkspaceFooterBar>
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              Saving updates the collection configuration only. Deleting the collection removes its content files but preserves the content type schema.
            </Text>
            <Button
              onClick={() => {
                void runCollectionSettingsAction((headers) => collectionManager.handleSaveCollectionSettings(headers));
              }}
              loading={loading}
              disabled={!canUpdateCollections || isBusy || (Boolean(collectionManager.collectionSettings.path) && Boolean(collectionManager.collectionSettingsPathError))}
              style={{ alignSelf: 'flex-start' }}
            >
              Save schema settings
            </Button>
          </Stack>
        </WorkspaceFooterBar>

        {canDeleteCollections ? (
          <WorkspaceSection
            title="Danger zone"
            description="Delete this collection and all entries stored at its path. The shared content type schema will be preserved."
            dividerTop
          >
            <Button color="red" variant="light" disabled={isBusy} onClick={() => {
              void runCollectionSettingsAction((headers) => collectionManager.handleDeleteCollection(headers));
            }} style={{ alignSelf: 'flex-start' }}>
              Delete collection
            </Button>
          </WorkspaceSection>
        ) : null}
      </WorkspaceMain>
    </WorkspacePage>
  );
}
