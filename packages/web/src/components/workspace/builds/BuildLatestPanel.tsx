import { Button, Group, Stack, Text } from '@mantine/core';
import { WorkspaceMetricBadge, WorkspacePanel, WorkspaceSection } from '../../ui/WorkspacePrimitives';
import type { BuildRecord } from './types';

export function BuildLatestPanel({
  build,
  currentBranch,
  formatDuration,
  statusColor,
  onCancelBuild,
  cancelPending,
}: {
  build?: BuildRecord;
  currentBranch?: string;
  formatDuration: (duration?: number) => string;
  statusColor: (status: BuildRecord['status']) => string;
  onCancelBuild: (buildId: string) => void;
  cancelPending: boolean;
}) {
  return (
    <WorkspacePanel>
      <WorkspaceSection
        title="Latest build"
        description="Recent deployment activity for the current project."
        badge={build ? <WorkspaceMetricBadge color={statusColor(build.status)}>{build.status}</WorkspaceMetricBadge> : undefined}
      >
        {!build ? (
          <Text size="sm" c="dimmed">No builds have been recorded yet.</Text>
        ) : (
          <Stack gap="sm">
            <Stack gap={2}>
              <Text fw={600}>{build.commitMessage || 'Manual build trigger'}</Text>
              <Text size="sm" c="dimmed">{build.branch} · {build.commit ? build.commit.slice(0, 7) : 'no commit'} · {new Date(build.createdAt).toLocaleString()}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" c="dimmed">Commit author</Text>
              <Text fw={500}>{build.commitAuthor || 'Unknown'}</Text>
              <Text size="sm" c="dimmed">Triggered by</Text>
              <Text fw={500}>{build.triggeredBy || 'manual'}</Text>
              <Text size="sm" c="dimmed">Duration</Text>
              <Text fw={500}>{formatDuration(build.duration)}</Text>
              <Text size="sm" c="dimmed">Current branch</Text>
              <Text fw={500}>{currentBranch || 'main'}</Text>
            </Stack>
            <Group gap="xs" wrap="wrap">
              {build.outputUrl ? (
                <Button variant="default" size="xs" component="a" href={build.outputUrl} target="_blank" rel="noreferrer">
                  Preview
                </Button>
              ) : null}
              {(build.status === 'pending' || build.status === 'running') ? (
                <Button variant="default" color="red" size="xs" onClick={() => onCancelBuild(build.id)} loading={cancelPending}>
                  Cancel
                </Button>
              ) : null}
            </Group>
          </Stack>
        )}
      </WorkspaceSection>
    </WorkspacePanel>
  );
}
