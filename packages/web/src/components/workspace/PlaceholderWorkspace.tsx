import { Button, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { WorkspaceHeader, WorkspaceInset, WorkspaceIntro, WorkspaceMain, WorkspacePage } from '../ui/WorkspacePrimitives';

export function PlaceholderWorkspace({
  title,
  selectedLabel,
  selectedDescription,
  action,
}: {
  title: string;
  selectedLabel?: ReactNode;
  selectedDescription?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <WorkspacePage>
      <WorkspaceHeader title={title} actions={action || <Button variant="default">Open {title}</Button>} />
      <WorkspaceMain>
        <WorkspaceIntro>
          <WorkspaceInset>
            <Stack gap="xs">
              {selectedLabel ? <Text fw={600}>{selectedLabel}</Text> : null}
              {selectedDescription ? <Text c="dimmed">{selectedDescription}</Text> : null}
              <Text c="dimmed">
                This section shell is routed and drilldown-enabled. Functional depth is planned in subsequent milestones.
              </Text>
            </Stack>
          </WorkspaceInset>
        </WorkspaceIntro>
      </WorkspaceMain>
    </WorkspacePage>
  );
}
