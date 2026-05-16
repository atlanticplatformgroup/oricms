import { SimpleGrid, Stack, Text } from '@mantine/core';
import { WorkspacePanel } from '../../ui/WorkspacePrimitives';
import type { BuildSummaryCounts } from './types';

export function BuildSummaryGrid({ counts }: { counts: BuildSummaryCounts }) {
  const items = [
    ['All builds', counts.total],
    ['Running', counts.running],
    ['Pending', counts.pending],
    ['Succeeded', counts.success],
    ['Failed', counts.failed],
    ['Cancelled', counts.cancelled],
  ] as const;

  return (
    <SimpleGrid cols={{ base: 2, md: 3, xl: 6 }} spacing="md">
      {items.map(([label, value]) => (
        <WorkspacePanel key={label}>
          <Stack gap={2}>
            <Text size="sm" c="dimmed">{label}</Text>
            <Text fw={700} size="xl">{value}</Text>
          </Stack>
        </WorkspacePanel>
      ))}
    </SimpleGrid>
  );
}
