import { Button, Group, Paper, Select, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { WorkspaceErrorState, WorkspaceListSurface, WorkspaceLoadingState, WorkspaceMetricBadge, WorkspaceOperationalTable, WorkspaceSection, WorkspaceTableContainer, WorkspaceTableToolbarInset, WorkspaceToolbar } from '../../ui/WorkspacePrimitives';
import { WORKSPACE_FORM_PREVIEW_BG, WORKSPACE_FORM_SECTION_BORDER, WORKSPACE_SHELL_DESCRIPTION_TEXT } from '../../ui/workspace-primitives.shared';
import type { BuildRecord, BuildStatus } from './types';

function BuildEmptyState({
  currentBranch,
  needsEnvironmentSetup,
  onTriggerBuild,
  settingsHref,
  triggerPending,
}: {
  currentBranch?: string;
  needsEnvironmentSetup: boolean;
  onTriggerBuild: () => void;
  settingsHref?: string;
  triggerPending: boolean;
}) {
  const steps = needsEnvironmentSetup
    ? [
        { label: '1', title: 'Configure environment', description: 'Add the deployment target OriCMS should build toward.' },
        { label: '2', title: 'Trigger first build', description: `Run the first build from ${currentBranch || 'main'} once setup is ready.` },
        { label: '3', title: 'Review deployments', description: 'Track status, previews, logs, and deployment results here.' },
      ]
    : [
        { label: '1', title: 'Trigger first build', description: `Run a build from ${currentBranch || 'main'} to create deployment history.` },
        { label: '2', title: 'Review result', description: 'Build status, previews, logs, and deployment links will appear here.' },
        { label: '3', title: 'Automate later', description: 'Add build webhooks when the deployment workflow is ready.' },
      ];

  return (
    <Paper
      withBorder
      p="xl"
      radius="md"
      style={{
        backgroundColor: WORKSPACE_FORM_PREVIEW_BG,
        borderColor: WORKSPACE_FORM_SECTION_BORDER,
      }}
    >
      <Stack gap="lg" align="stretch">
        <Stack gap={6}>
          <Text fw={700} size="lg">
            {needsEnvironmentSetup ? 'Set up builds for this project' : 'No build history yet'}
          </Text>
          <Text size="sm" maw={720} style={{ color: WORKSPACE_SHELL_DESCRIPTION_TEXT, lineHeight: 1.55 }}>
            {needsEnvironmentSetup
              ? 'Start by adding an environment. After that, OriCMS can trigger builds, record deployment results, and show branch activity here.'
              : `Your environment is ready. Trigger a build from ${currentBranch || 'main'} to create the first deployment job for this project.`}
          </Text>
        </Stack>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" verticalSpacing="sm">
          {steps.map((step) => (
            <Paper
              key={step.label}
              withBorder
              p="sm"
              radius="md"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                borderColor: WORKSPACE_FORM_SECTION_BORDER,
              }}
            >
              <Stack gap={6}>
                <WorkspaceMetricBadge color="slate">Step {step.label}</WorkspaceMetricBadge>
                <Text fw={600} size="sm">{step.title}</Text>
                <Text size="xs" style={{ color: WORKSPACE_SHELL_DESCRIPTION_TEXT, lineHeight: 1.45 }}>
                  {step.description}
                </Text>
              </Stack>
            </Paper>
          ))}
        </SimpleGrid>
        <Group gap="xs" wrap="wrap">
          <WorkspaceMetricBadge>Branch {currentBranch || 'main'}</WorkspaceMetricBadge>
          <WorkspaceMetricBadge color={needsEnvironmentSetup ? 'orange' : 'yellow'}>
            {needsEnvironmentSetup ? 'Environment required' : 'Manual build ready'}
          </WorkspaceMetricBadge>
        </Group>
        <Group gap="xs" wrap="wrap">
          {needsEnvironmentSetup && settingsHref ? (
            <Button component="a" href={settingsHref}>
              Configure environments
            </Button>
          ) : (
            <Button onClick={onTriggerBuild} loading={triggerPending}>
              Trigger first build
            </Button>
          )}
          {!needsEnvironmentSetup && settingsHref ? (
            <Button component="a" href={settingsHref} variant="default">
              Review environments
            </Button>
          ) : null}
        </Group>
      </Stack>
    </Paper>
  );
}

export function BuildHistoryTable({
  selectedView,
  statusFilter,
  builds,
  loading,
  error,
  cancelPending,
  currentBranch,
  needsEnvironmentSetup,
  onCancelBuild,
  onSelectView,
  onRetry,
  onTriggerBuild,
  settingsHref,
  triggerPending,
}: {
  selectedView: string;
  statusFilter?: BuildStatus;
  builds: BuildRecord[];
  loading: boolean;
  error: boolean;
  cancelPending: boolean;
  currentBranch?: string;
  needsEnvironmentSetup: boolean;
  onCancelBuild: (buildId: string) => void;
  onSelectView: (view: string) => void;
  onRetry?: () => void;
  onTriggerBuild: () => void;
  settingsHref?: string;
  triggerPending: boolean;
}) {
  const hasBuilds = builds.length > 0;
  const showToolbar = loading || hasBuilds;

  return (
    <WorkspaceListSurface>
      <WorkspaceSection
        title="Build history"
        description="Inspect recent jobs, their status, branch, and deployment outcome."
        badge={hasBuilds ? <WorkspaceMetricBadge>{statusFilter ? `${statusFilter} filter` : 'All statuses'}</WorkspaceMetricBadge> : undefined}
      >
        <Stack gap="sm">
          {showToolbar ? (
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
          ) : null}
          {loading ? (
            <WorkspaceLoadingState label="Loading builds…" />
          ) : error ? (
            <WorkspaceErrorState title="Failed to load builds" message="Build history is unavailable right now." onRetry={onRetry} />
          ) : !hasBuilds ? (
            <BuildEmptyState
              currentBranch={currentBranch}
              needsEnvironmentSetup={needsEnvironmentSetup}
              onTriggerBuild={onTriggerBuild}
              settingsHref={settingsHref}
              triggerPending={triggerPending}
            />
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
