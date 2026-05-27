import { Button, Group, Paper, Stack, Text } from '@mantine/core';
import { WorkspaceMetricBadge } from '../../ui/WorkspacePrimitives';
import { WORKSPACE_FORM_PREVIEW_BG, WORKSPACE_FORM_SECTION_BORDER, WORKSPACE_SHELL_DESCRIPTION_TEXT } from '../../ui/workspace-primitives.shared';

export function BuildSetupAlert({
  projectLoading,
  projectError,
  hasEnvironments,
  hasBuildWebhooks,
  settingsHref,
}: {
  projectLoading: boolean;
  projectError: boolean;
  hasEnvironments: boolean;
  hasBuildWebhooks: boolean;
  settingsHref?: string;
}) {
  if (projectLoading || projectError) return null;

  const setupState = !hasEnvironments
    ? {
        title: 'Environment setup needed',
        message: 'Add an environment before relying on automated build and deployment workflows.',
        badge: 'Required setup',
      }
    : !hasBuildWebhooks
      ? {
          title: 'Deploy automation is not configured',
          message: 'Manual builds are available, but no environment build webhook is configured yet.',
          badge: 'Manual only',
        }
      : null;

  if (!setupState) return null;

  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      style={{
        backgroundColor: WORKSPACE_FORM_PREVIEW_BG,
        borderColor: WORKSPACE_FORM_SECTION_BORDER,
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
        <Stack gap={6} miw={0} flex={1}>
          <Group gap="xs" wrap="wrap">
            <Text fw={700}>{setupState.title}</Text>
            <WorkspaceMetricBadge color={!hasEnvironments ? 'orange' : 'yellow'}>{setupState.badge}</WorkspaceMetricBadge>
          </Group>
          <Text size="sm" lh={1.5} style={{ color: WORKSPACE_SHELL_DESCRIPTION_TEXT }}>
            {setupState.message}
          </Text>
        </Stack>
        {settingsHref ? (
          <Button component="a" href={settingsHref} variant="default" size="sm">
            Open environment settings
          </Button>
        ) : null}
      </Group>
    </Paper>
  );
}
