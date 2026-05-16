import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Stack, Text } from '@mantine/core';
import type { Environment, Project } from '@ori/shared';
import { buildsApi } from '../../lib/api/builds';
import { projectsApi } from '../../lib/api/projects';
import { WorkspaceErrorState, WorkspaceHeader, WorkspaceLoadingState, WorkspaceMain, WorkspacePage, WorkspaceSection, WorkspaceSplitMain } from '../ui/WorkspacePrimitives';
import { BuildHistoryTable } from './builds/BuildHistoryTable';
import { BuildLatestPanel } from './builds/BuildLatestPanel';
import { BuildSetupAlert } from './builds/BuildSetupAlert';
import { BuildSummaryGrid } from './builds/BuildSummaryGrid';
import { buildStatusColor, formatBuildDuration, mapBuildViewToStatus, type BuildRecord, type BuildSummaryCounts } from './builds/types';

interface BuildsWorkspaceProps {
  projectId: string;
  selectedView: string;
  selectedLabel?: string;
  selectedDescription?: string;
  currentBranch?: string;
  onSelectView?: (view: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', options?: { duration?: number }) => void;
}

function emptyCounts(): BuildSummaryCounts {
  return { total: 0, running: 0, pending: 0, success: 0, failed: 0, cancelled: 0 };
}

export function BuildsWorkspace({
  projectId,
  selectedView,
  selectedLabel,
  selectedDescription,
  currentBranch,
  onSelectView,
  showToast,
}: BuildsWorkspaceProps) {
  const queryClient = useQueryClient();
  const statusFilter = mapBuildViewToStatus(selectedView);

  const projectQuery = useQuery<{ project: Project }>({
    queryKey: ['build-workspace-project', projectId],
    queryFn: () => projectsApi.get(projectId),
    enabled: Boolean(projectId),
  });

  const summaryQuery = useQuery<{ latestBuild?: BuildRecord; counts: BuildSummaryCounts }>({
    queryKey: ['build-workspace-summary', projectId],
    queryFn: () => buildsApi.getSummary(projectId),
    enabled: Boolean(projectId),
    refetchInterval: 5000,
  });

  const buildsQuery = useQuery<{ builds: BuildRecord[]; pagination: unknown }>({
    queryKey: ['build-workspace-list', projectId, statusFilter || 'all'],
    queryFn: () => buildsApi.list(projectId, { status: statusFilter, limit: 20, offset: 0 }),
    enabled: Boolean(projectId),
    refetchInterval: (query) => {
      const data = query.state.data as { builds?: BuildRecord[] } | undefined;
      const hasActive = data?.builds?.some((build) => build.status === 'running' || build.status === 'pending');
      return hasActive ? 5000 : false;
    },
  });

  const triggerBuildMutation = useMutation({
    mutationFn: () => buildsApi.trigger(projectId, currentBranch || 'main'),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['build-workspace-summary', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['build-workspace-list', projectId] }),
      ]);
      showToast('Build triggered successfully', 'success');
    },
    onError: () => showToast('Failed to trigger build', 'error'),
  });

  const cancelBuildMutation = useMutation({
    mutationFn: (buildId: string) => buildsApi.cancel(projectId, buildId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['build-workspace-summary', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['build-workspace-list', projectId] }),
      ]);
      showToast('Build cancelled', 'success');
    },
    onError: () => showToast('Failed to cancel build', 'error'),
  });

  const summary = (summaryQuery.data?.counts ?? emptyCounts()) as BuildSummaryCounts;
  const latestBuild = summaryQuery.data?.latestBuild as BuildRecord | undefined;
  const builds = useMemo(() => (buildsQuery.data?.builds ?? []) as BuildRecord[], [buildsQuery.data?.builds]);
  const project = projectQuery.data?.project as Project | undefined;
  const environments = (project?.settings?.environments ?? []) as Environment[];
  const hasEnvironments = environments.length > 0;
  const hasBuildWebhooks = environments.some((environment) => Boolean(environment.buildWebhook));

  return (
    <WorkspacePage>
      <WorkspaceHeader
        title="Builds"
        description={selectedDescription || 'Track build health, recent deployment jobs, and manual triggers.'}
        meta={<Text size="sm" c="dimmed">{selectedLabel || 'Recent Builds'}{currentBranch ? ` · branch ${currentBranch}` : ''}</Text>}
        actions={
          <Button onClick={() => triggerBuildMutation.mutate()} loading={triggerBuildMutation.isPending}>
            Trigger build
          </Button>
        }
      />

      <BuildSetupAlert
        projectLoading={projectQuery.isLoading}
        projectError={projectQuery.isError}
        hasEnvironments={hasEnvironments}
        hasBuildWebhooks={hasBuildWebhooks}
      />

      {summaryQuery.isLoading && !summaryQuery.data ? (
        <WorkspaceLoadingState label="Loading build summary…" />
      ) : summaryQuery.isError ? (
        <WorkspaceErrorState
          title="Failed to load build summary"
          message="Build status is unavailable right now. Reload and try again."
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : (
        <BuildSummaryGrid counts={summary} />
      )}

      <WorkspaceMain>
        <WorkspaceSplitMain
          primary={
            <BuildHistoryTable
              selectedView={selectedView}
              statusFilter={statusFilter}
              builds={builds}
              loading={buildsQuery.isLoading}
              error={buildsQuery.isError}
              cancelPending={cancelBuildMutation.isPending}
              onCancelBuild={(buildId) => cancelBuildMutation.mutate(buildId)}
              onSelectView={(view) => onSelectView?.(view)}
              onRetry={() => void buildsQuery.refetch()}
            />
          }
          secondary={
            <Stack gap="md">
              <BuildLatestPanel
                build={latestBuild}
                currentBranch={currentBranch}
                formatDuration={formatBuildDuration}
                statusColor={buildStatusColor}
                onCancelBuild={(buildId) => cancelBuildMutation.mutate(buildId)}
                cancelPending={cancelBuildMutation.isPending}
              />
              <WorkspaceSection
                title="Build behavior"
                description="Trigger builds manually from the current branch or use environment webhooks for deployment automation."
              >
                <Stack gap={4}>
                  <Text size="sm" c="dimmed">Current branch</Text>
                  <Text fw={600}>{currentBranch || 'main'}</Text>
                  <Text size="sm" c="dimmed">Environment webhooks configured</Text>
                  <Text fw={600}>{hasBuildWebhooks ? 'Yes' : 'No'}</Text>
                </Stack>
              </WorkspaceSection>
            </Stack>
          }
          primarySpan={{ base: 12, xl: 8 }}
          secondarySpan={{ base: 12, xl: 4 }}
        />
      </WorkspaceMain>
    </WorkspacePage>
  );
}
