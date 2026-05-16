import { Button, Group, Select, Stack, Table, Text } from '@mantine/core';
import { WorkspaceEmptyState, WorkspaceErrorState, WorkspaceListSurface, WorkspaceLoadingState, WorkspaceMetricBadge, WorkspaceOperationalTable, WorkspaceSection, WorkspaceTableContainer, WorkspaceTableToolbarInset, WorkspaceToolbar } from '../../ui/WorkspacePrimitives';
import type { BuildRecord, BuildStatus } from './types';

export function BuildHistoryTable({
  selectedView,
  statusFilter,
  builds,
  loading,
  error,
  cancelPending,
  onCancelBuild,
  onSelectView,
  onRetry,
}: {
  selectedView: string;
  statusFilter?: BuildStatus;
  builds: BuildRecord[];
  loading: boolean;
  error: boolean;
  cancelPending: boolean;
  onCancelBuild: (buildId: string) => void;
  onSelectView: (view: string) => void;
  onRetry?: () => void;
}) {
  return (
    <WorkspaceListSurface>
      <WorkspaceSection
        title="Build history"
        description="Inspect recent jobs, their status, branch, and deployment outcome."
        badge={<WorkspaceMetricBadge>{statusFilter ? `${statusFilter} filter` : 'All statuses'}</WorkspaceMetricBadge>}
      >
        <Stack gap="sm">
          <WorkspaceTableToolbarInset>
            <WorkspaceToolbar
              actions={(
                <Select
                  size="xs"
                  value={selectedView}
                  data={[
                    { value: 'recent', label: 'Recent Builds' },
                    { value: 'running', label: 'Running' },
                    { value: 'failed', label: 'Failed' },
                  ]}
                  maw={180}
                  style={{ width: '100%' }}
                  aria-label="Build status filter"
                  onChange={(value) => {
                    if (value) onSelectView(value);
                  }}
                />
              )}
            />
          </WorkspaceTableToolbarInset>
          {loading ? (
            <WorkspaceLoadingState label="Loading builds…" />
          ) : error ? (
            <WorkspaceErrorState title="Failed to load builds" message="Build history is unavailable right now." onRetry={onRetry} />
          ) : builds.length === 0 ? (
            <WorkspaceEmptyState title="No builds yet" message="Trigger a build to start populating deployment history." />
          ) : (
            <WorkspaceTableContainer>
            <WorkspaceOperationalTable>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Branch</Table.Th>
                  <Table.Th>Commit</Table.Th>
                  <Table.Th>Message</Table.Th>
                  <Table.Th>Triggered by</Table.Th>
                  <Table.Th>Started</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {builds.map((build) => (
                  <Table.Tr key={build.id}>
                    <Table.Td><WorkspaceMetricBadge color={build.status === 'success' ? 'green' : build.status === 'failed' ? 'red' : build.status === 'running' ? 'blue' : build.status === 'pending' ? 'yellow' : 'gray'}>{build.status}</WorkspaceMetricBadge></Table.Td>
                    <Table.Td>{build.branch}</Table.Td>
                    <Table.Td>{build.commit ? build.commit.slice(0, 7) : '-'}</Table.Td>
                    <Table.Td>{build.commitMessage || 'Manual build trigger'}</Table.Td>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text size="sm">{build.triggeredBy || 'manual'}</Text>
                        <Text size="xs" c="dimmed">{build.commitAuthor || 'Unknown author'}</Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>{new Date(build.createdAt).toLocaleString()}</Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="wrap">
                        {build.outputUrl ? (
                          <Button variant="default" size="xs" component="a" href={build.outputUrl} target="_blank" rel="noreferrer">
                            Preview
                          </Button>
                        ) : null}
                        {(build.status === 'pending' || build.status === 'running') ? (
                          <Button
                            variant="default"
                            color="red"
                            size="xs"
                            onClick={() => onCancelBuild(build.id)}
                            loading={cancelPending}
                          >
                            Cancel
                          </Button>
                        ) : null}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </WorkspaceOperationalTable>
            </WorkspaceTableContainer>
          )}
        </Stack>
      </WorkspaceSection>
    </WorkspaceListSurface>
  );
}
