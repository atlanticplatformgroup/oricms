import { Accordion, Alert, Badge, Button, Center, Divider, Grid, Group, Loader, ScrollArea, Select, Stack, Text } from '@mantine/core';
import type { CollectionConfig, SchemaField } from '@ori/shared';
import type { ReactNode } from 'react';
import { useEditorContext } from '../../../contexts/workspace/EditorContext';
import { useEntryHistoryContext } from '../../../contexts/workspace/EntryHistoryContext';
import { formatFieldCount, toLabel } from '../../../lib/workspace/format';
import { WorkspaceHeader, WorkspaceInset, WorkspaceMetricBadge, WorkspacePage, WorkspacePanel, WorkspaceSection, WorkspaceSplitMain } from '../../ui/WorkspacePrimitives';

interface CollectionsHistoryViewProps {
  selectedCollection: CollectionConfig | null;
  canUpdateEntries: boolean;
  onBackToEditor: () => void;
  renderReadonlyFieldValue: (value: unknown, field?: SchemaField, context?: { relationLabels?: Record<string, string> }) => ReactNode;
}

export function CollectionsHistoryView(props: CollectionsHistoryViewProps) {
  const entryEditor = useEditorContext();
  const history = useEntryHistoryContext();

  const historyPrimary = (
    <WorkspacePanel>
      <Stack gap="md">
        <WorkspaceSection title="Timeline" badge={<WorkspaceMetricBadge>{`${history.historyTimelineItems.length} commits`}</WorkspaceMetricBadge>}>
          <></>
        </WorkspaceSection>
        <ScrollArea h={560} type="never">
          <Stack gap="xs">
            {history.historyTimelineItems.map((item) => {
              const isActive = item.hash === history.selectedHistoryHash;
              const changedCount = history.historyChangedCountsByHash[item.hash] ?? 0;
              return (
                <Button
                  key={item.hash}
                  variant={isActive ? 'light' : 'default'}
                  color="gray"
                  justify="flex-start"
                  fullWidth
                  h="auto"
                  p="sm"
                  onClick={() => history.setSelectedHistoryHash(item.hash)}
                >
                  <Stack gap={6} align="stretch" style={{ flex: 1 }}>
                    <Group justify="space-between" wrap="nowrap">
                      <Badge variant="outline" color="gray">{item.hash.slice(0, 8)}</Badge>
                      {isActive && <Badge variant="light" color="gray">Selected</Badge>}
                    </Group>
                    <Text size="sm" ta="left">{item.message}</Text>
                    <Text size="xs" c={isActive ? undefined : 'dimmed'} ta="left">{formatFieldCount(changedCount, 'revision')}</Text>
                    <Text size="xs" c={isActive ? undefined : 'dimmed'} ta="left">{item.author}{item.date ? ` • ${new Date(item.date).toLocaleString()}` : ''}</Text>
                  </Stack>
                </Button>
              );
            })}
          </Stack>
        </ScrollArea>
      </Stack>
    </WorkspacePanel>
  );

  const historySecondary = (
    <WorkspacePanel>
      <Stack gap="sm">
        <WorkspaceHeader
          title={history.comparisonSummary}
          meta={
            history.selectedHistoryItem ? (
              <Stack gap={2}>
                <Group gap="xs" wrap="nowrap">
                  <Badge variant="light" color="gray">{history.selectedHistoryItem.hash.slice(0, 8)}</Badge>
                  <Text size="sm" truncate="end">{history.selectedHistoryItem.message}</Text>
                </Group>
                <Text size="xs" c="dimmed">{history.selectedHistoryItem.author} · {history.selectedHistoryItem.date ? new Date(history.selectedHistoryItem.date).toLocaleString() : 'Not available'}</Text>
                <Text size="xs" c="dimmed">{formatFieldCount(history.historyFieldDiffs.length, 'comparison')} against {history.comparisonTargetLabel}</Text>
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">Choose a revision from the timeline to inspect its history and compare it against another point in time.</Text>
            )
          }
        />

        <Group gap="sm" align="end" wrap="nowrap">
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Text size="xs" c="dimmed">Base for comparison</Text>
            <Select
              size="md"
              clearable
              placeholder="Current draft"
              data={history.historyTimelineItems
                .filter((item) => item.hash !== history.selectedHistoryHash)
                .map((item) => ({ value: item.hash, label: `${item.hash.slice(0, 8)} · ${item.message}` }))}
              value={history.selectedCompareHash}
              onChange={(nextValue) => history.setSelectedCompareHash(nextValue)}
            />
          </Stack>
          <Stack gap={4} align="flex-end">
            <Button
              onClick={history.openRestoreConfirm}
              disabled={!props.canUpdateEntries || history.selectedHistoryVersionLoading || history.historyFieldDiffs.length === 0 || entryEditor.updateEntryPending}
            >
              Restore this revision
            </Button>
          </Stack>
        </Group>

        <Text size="xs" c="dimmed">{history.restoreDisabledReason}</Text>
        <Divider />

        {history.selectedHistoryVersionLoading || history.selectedCompareVersionLoading ? (
          <Center py="md"><Loader size="sm" /></Center>
        ) : history.selectedHistoryVersionError || history.selectedCompareVersionError ? (
          <Alert color="red" title="Failed to load revision">
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm">Unable to load revision data for comparison.</Text>
              <Button size="xs" variant="default" onClick={history.retryHistoryVersions}>Retry</Button>
            </Group>
          </Alert>
        ) : (
          <Stack gap="sm">
            <WorkspaceSection title="Field differences" description="Left shows the base. Right shows the selected revision." badge={<WorkspaceMetricBadge>{formatFieldCount(history.historyFieldDiffs.length, 'comparison')}</WorkspaceMetricBadge>}>
              <></>
            </WorkspaceSection>
            {history.historyFieldDiffs.length === 0 ? (
              <WorkspaceInset>
                <Stack gap={4}>
                  <Text fw={600}>No differences found</Text>
                  <Text size="sm" c="dimmed">These two versions resolve to the same field values.</Text>
                </Stack>
              </WorkspaceInset>
            ) : (
              <ScrollArea h={560} type="never">
                <Accordion multiple defaultValue={history.historyFieldDiffs.slice(0, 3).map((diff) => diff.key)}>
                  {history.historyFieldDiffs.map((diff) => {
                    const field = entryEditor.editorFieldMap.get(diff.key);
                    return (
                      <Accordion.Item key={diff.key} value={diff.key}>
                        <Accordion.Control py="sm">
                          <Group justify="space-between" wrap="nowrap" align="flex-start">
                            <Stack gap={1}>
                              <Text fw={600}>{field?.label || toLabel(diff.key)}</Text>
                              <Text size="xs" c="dimmed">{field?.type ? `${toLabel(field.type)} field` : 'Field values differ'}</Text>
                            </Stack>
                            <Badge color={diff.kind === 'added' ? 'green' : diff.kind === 'removed' ? 'red' : 'gray'} variant={diff.kind === 'changed' ? 'outline' : 'light'} size="sm">{toLabel(diff.kind)}</Badge>
                          </Group>
                        </Accordion.Control>
                        <Accordion.Panel>
                          <Grid gutter="sm">
                            <Grid.Col span={{ base: 12, md: 6 }}>
                              <WorkspaceInset>
                                <Stack gap="xs">
                                  <Group gap="xs">
                                    <Badge variant="light" color="gray">Base</Badge>
                                    <Text size="xs" c="dimmed">{history.selectedCompareItem ? `Revision ${history.selectedCompareItem.hash.slice(0, 8)}` : 'Current draft'}</Text>
                                  </Group>
                                  {diff.kind !== 'added'
                                    ? props.renderReadonlyFieldValue(diff.before, field, { relationLabels: entryEditor.relationLabelMapByField[diff.key] })
                                    : <Text size="sm" c="dimmed">(empty)</Text>}
                                </Stack>
                              </WorkspaceInset>
                            </Grid.Col>
                            <Grid.Col span={{ base: 12, md: 6 }}>
                              <WorkspaceInset>
                                <Stack gap="xs">
                                  <Group gap="xs">
                                    <Badge variant="light" color="gray">Selected revision</Badge>
                                    <Text size="xs" c="dimmed">{history.selectedHistoryItem ? history.selectedHistoryItem.hash.slice(0, 8) : ''}</Text>
                                  </Group>
                                  {diff.kind !== 'removed'
                                    ? props.renderReadonlyFieldValue(diff.after, field, { relationLabels: entryEditor.relationLabelMapByField[diff.key] })
                                    : <Text size="sm" c="dimmed">(empty)</Text>}
                                </Stack>
                              </WorkspaceInset>
                            </Grid.Col>
                          </Grid>
                        </Accordion.Panel>
                      </Accordion.Item>
                    );
                  })}
                </Accordion>
              </ScrollArea>
            )}
          </Stack>
        )}
      </Stack>
    </WorkspacePanel>
  );

  return (
    <WorkspacePage>
      <WorkspaceSection
        title="Entry history"
        description="Browse revisions, compare any two points in time, and restore a prior version as a new commit."
        actions={<Button size="xs" variant="default" onClick={props.onBackToEditor}>Back to editor</Button>}
      >
        <></>
      </WorkspaceSection>

      {history.historyLoading ? (
        <Center py="md"><Loader size="sm" /></Center>
      ) : history.historyError ? (
        <Alert color="red" title="Failed to load history">
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">Unable to fetch commit history for this entry.</Text>
            <Button size="xs" variant="default" onClick={history.retryHistory}>Retry</Button>
          </Group>
        </Alert>
      ) : history.historyTimelineItems.length === 0 ? (
        <Alert color="blue" title="No history yet">No committed versions were found for this entry.</Alert>
      ) : (
        <WorkspaceSplitMain primary={historyPrimary} secondary={historySecondary} primarySpan={{ base: 12, lg: 4 }} secondarySpan={{ base: 12, lg: 8 }} />
      )}
    </WorkspacePage>
  );
}
