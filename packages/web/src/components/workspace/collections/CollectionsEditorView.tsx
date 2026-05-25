import { Alert, Badge, Button, Center, Group, Loader, Menu, Select, Stack, Text, TextInput } from '@mantine/core';
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import type { CollectionConfig, CollectionEntry, SchemaField } from '@ori/shared';
import { useEffect, type ReactNode } from 'react';
import { useEditorContext } from '../../../contexts/workspace/EditorContext';
import { useProject } from '../../../contexts/useProject';
import { usePresence } from '../../../hooks/usePresence';
import { resolveEditorFieldWidth } from '../../../lib/entries/editor';
import { getDisplayText } from '../../../lib/workspace/format';
import { CollectionStatusBadge } from '../../ui/CollectionStatusBadge';
import { WorkspaceEditorFieldGrid, WorkspaceFieldGrid, WorkspaceFooterBar, WorkspaceFormSection, WorkspaceFormSurface, WorkspaceHeader, WorkspaceHeaderActionIcon, WorkspaceMain, WorkspacePage } from '../../ui/WorkspacePrimitives';
import { EditorField } from '../../fields/EditorField';

interface CollectionsEditorViewProps {
  selectedEntry: CollectionEntry | null;
  selectedCollection: CollectionConfig | null;
  primaryField: string;
  activeHistoryView: boolean;
  canUpdateEntries: boolean;
  canDeleteEntries: boolean;
  selectedEntryLoading: boolean;
  onGoToHistory: () => void;
  onOpenBranchTransfer: () => void;
  selectedEntryError: boolean;
  onRetrySelectedEntry: () => void;
  currentBranchName: string;
  canOpenBranchTransfer: boolean;
}

export function CollectionsEditorView(props: CollectionsEditorViewProps) {
  const entryEditor = useEditorContext();
  const { currentProject } = useProject();
  const { users, updateAction } = usePresence(
    currentProject?.id,
    props.selectedCollection && props.selectedEntry
      ? `collections/${props.selectedCollection.id}/${props.selectedEntry.$id}`
      : 'collections',
  );
  const activeEditors = users.filter((user) => user.action === 'editing');

  useEffect(() => {
    updateAction(entryEditor.isDirty ? 'editing' : 'viewing');
  }, [entryEditor.isDirty, updateAction]);

  const renderEditorField = (field: SchemaField): ReactNode => {
    if (!entryEditor.draftEntry) return null;
    const fieldValue = entryEditor.draftEntry[field.key];
    const fieldError = entryEditor.editorFieldErrors[field.key];
    const baselineValue = entryEditor.baselineEntry?.[field.key];
    const fieldChanged = JSON.stringify(fieldValue ?? null) !== JSON.stringify(baselineValue ?? null);

    return (
      <EditorField
        field={field}
        value={fieldValue}
        error={fieldError}
        disabled={!props.canUpdateEntries}
        changed={fieldChanged}
        onChange={(nextValue) => entryEditor.handleFieldChange(field.key, nextValue)}
        context={entryEditor.fieldRendererContext}
      />
    );
  };

  return (
    <WorkspacePage>
      <WorkspaceHeader
        title={getDisplayText(entryEditor.draftEntry?.[props.primaryField] ?? props.selectedEntry?.[props.primaryField] ?? props.selectedEntry?.$id)}
        description={`${props.selectedCollection?.label || ''}${props.selectedCollection?.path ? ` · ${props.selectedCollection.path}` : ''}`}
        actions={
          <>
            {!props.activeHistoryView && entryEditor.draftEntry && (
              <Select
                aria-label="Entry status"
                data={[{ label: 'Draft', value: 'draft' }, { label: 'Ready', value: 'published' }]}
                value={entryEditor.draftEntry.$status}
                maw={160}
                w="100%"
                disabled={!props.canUpdateEntries}
                onChange={(nextStatus) => {
                  if (!nextStatus) return;
                  entryEditor.handleFieldChange('$status', nextStatus as CollectionEntry['$status']);
                }}
              />
            )}
            {!props.activeHistoryView && <Button variant="default" onClick={props.onGoToHistory} disabled={props.selectedEntryLoading}>History</Button>}
            {!props.activeHistoryView && (
              <Button variant="default" onClick={props.onOpenBranchTransfer} disabled={!props.canOpenBranchTransfer || props.selectedEntryLoading}>
                Copy to branch...
              </Button>
            )}
            {!props.activeHistoryView && props.canDeleteEntries && (
              <Menu position="bottom-end" shadow="md">
                <Menu.Target>
                  <WorkspaceHeaderActionIcon ariaLabel="Entry actions">
                    <EllipsisVerticalIcon width={16} height={16} />
                  </WorkspaceHeaderActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Entry</Menu.Label>
                  <Menu.Item color="red" onClick={() => void entryEditor.handleDeleteEntry()} disabled={entryEditor.deleteEntryPending}>Delete entry</Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </>
        }
      />

      {props.selectedEntryLoading || !entryEditor.draftEntry ? (
        <Center py="xl"><Loader size="sm" /></Center>
      ) : props.selectedEntryError ? (
        <Alert color="red" title="Unable to load entry">
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">Reload the page and try again.</Text>
            <Button size="xs" variant="default" onClick={props.onRetrySelectedEntry}>Retry</Button>
          </Group>
        </Alert>
      ) : (
        <WorkspaceMain>
          {activeEditors.length > 0 ? (
            <Alert color="blue" title={activeEditors.length === 1 ? `${activeEditors[0].name} is also editing` : 'Multiple editors are active'}>
              {activeEditors.length === 1
                ? 'Another editor is working on this entry. Saving will still work, but stale changes will be rejected.'
                : 'Several editors are working on this entry. Saving will still work, but stale changes will be rejected.'}
            </Alert>
          ) : null}
          <WorkspaceFormSurface>
            {entryEditor.editorSections.map((section) => (
              <WorkspaceFormSection
                key={section.id}
                title={section.title}
                description={section.description}
                collapsible={section.collapsible}
                defaultCollapsed={section.defaultCollapsed}
              >
                <WorkspaceEditorFieldGrid
                  items={section.fields.map((field) => ({
                    key: field.key,
                    width: resolveEditorFieldWidth(field),
                    content: renderEditorField(field),
                  }))}
                />
              </WorkspaceFormSection>
            ))}

            <WorkspaceFooterBar>
              <Group justify="space-between" wrap="wrap" gap="xs">
                <Group gap="xs">
                  <Badge color={entryEditor.isDirty ? 'orange' : 'green'} variant="light">{entryEditor.isDirty ? 'Unsaved changes' : 'No unsaved changes'}</Badge>
                  {entryEditor.editorValidationCount > 0 ? <Badge color="red" variant="light">{`${entryEditor.editorValidationCount} validation ${entryEditor.editorValidationCount === 1 ? 'issue' : 'issues'}`}</Badge> : null}
                  {entryEditor.showCommitBar && <Badge color="blue" variant="light">Commit step</Badge>}
                </Group>

                {!entryEditor.showCommitBar ? (
                  <Button
                    loading={entryEditor.updateEntryPending}
                    disabled={!entryEditor.isDirty || !props.canUpdateEntries || entryEditor.editorValidationCount > 0}
                    data-testid="open-commit-bar"
                    onClick={entryEditor.handleSaveEntry}
                  >
                    Save changes
                  </Button>
                ) : (
                  <Stack gap="sm" flex={1} miw={0}>
                    <Stack gap={4} flex={1} miw={0}>
                      <Text size="sm" fw={500}>{`${entryEditor.changedFieldCount} ${entryEditor.changedFieldCount === 1 ? 'field' : 'fields'} will be committed`}</Text>
                      <Group gap="xs" wrap="wrap">
                        {entryEditor.entryStatusChanged ? (
                          <Group gap={6} wrap="nowrap">
                            <Text size="xs" c="dimmed">Status</Text>
                            <CollectionStatusBadge status={entryEditor.baselineEntry?.$status || 'draft'} />
                            <Text size="xs" c="dimmed">→</Text>
                            <CollectionStatusBadge status={entryEditor.draftEntry?.$status || 'draft'} />
                          </Group>
                        ) : null}
                        {entryEditor.editorValidationCount === 0 ? <Text size="xs" c="dimmed">Changes will be committed to {props.currentBranchName}.</Text> : <Text size="xs" c="red">Resolve validation issues before committing.</Text>}
                      </Group>
                    </Stack>
                    <WorkspaceFieldGrid cols={{ base: 1, md: 2 }}>
                      <TextInput
                        label="Commit message"
                        placeholder="Describe this change"
                        value={entryEditor.commitMessage}
                        data-testid="commit-message"
                        onChange={(event) => entryEditor.setCommitMessage(event.currentTarget.value)}
                        w="100%"
                      />
                      <Group gap="sm" wrap="wrap" justify="flex-end" align="flex-end">
                        <Button
                          loading={entryEditor.updateEntryPending}
                          disabled={!entryEditor.commitMessage.trim() || entryEditor.editorValidationCount > 0}
                          data-testid="commit-entry"
                          onClick={() => void entryEditor.handleCommitEntry()}
                        >
                          Commit
                        </Button>
                        <Button
                          variant="default"
                          data-testid="cancel-commit"
                          onClick={() => {
                            entryEditor.setShowCommitBar(false);
                            entryEditor.setCommitMessage('');
                          }}
                        >
                          Cancel
                        </Button>
                      </Group>
                    </WorkspaceFieldGrid>
                  </Stack>
                )}
              </Group>
            </WorkspaceFooterBar>
          </WorkspaceFormSurface>
        </WorkspaceMain>
      )}
    </WorkspacePage>
  );
}
