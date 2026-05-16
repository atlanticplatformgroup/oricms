import { Badge, Stack, Text } from '@mantine/core';
import { WorkspaceInset, WorkspaceMetricBadge, WorkspaceSection } from '../../ui/WorkspacePrimitives';

interface MembersSummaryPanelProps {
  selectedView: string;
  selectedCount: number;
  counts: {
    total: number;
    humans: number;
    agents: number;
    owners: number;
  };
}

function getViewDescription(selectedView: string): string {
  if (selectedView === 'humans') return 'Human collaborators can be invited, assigned a role, and removed from the project.';
  if (selectedView === 'agents') return 'AI agents are service accounts with a project role and a generated token shown once at creation.';
  return 'Humans and AI agents share one membership model so permissions stay consistent across the product.';
}

export function MembersSummaryPanel({ selectedView, selectedCount, counts }: MembersSummaryPanelProps) {
  return (
    <Stack gap="md">
      <WorkspaceSection
        title="Membership model"
        description={getViewDescription(selectedView)}
        badge={<WorkspaceMetricBadge>{`${selectedCount} in view`}</WorkspaceMetricBadge>}
      >
        <WorkspaceInset>
          <Stack gap="xs">
            <Text fw={600}>Current breakdown</Text>
            <Stack gap={6}>
              <Badge variant="light" color="gray">{`${counts.total} total members`}</Badge>
              <Badge variant="light" color="blue">{`${counts.humans} humans`}</Badge>
              <Badge variant="light" color="yellow">{`${counts.agents} AI agents`}</Badge>
              <Badge variant="light" color="indigo">{`${counts.owners} owners`}</Badge>
            </Stack>
          </Stack>
        </WorkspaceInset>
      </WorkspaceSection>

      <WorkspaceSection
        title="Operational notes"
        description="The member directory is the single place for role changes and agent onboarding."
      >
        <WorkspaceInset>
          <Stack gap={6}>
            <Text size="sm">Inviting a human creates a membership or an invite, depending on whether the email already belongs to a user.</Text>
            <Text size="sm">Adding an AI agent creates a service account and returns a token once. Store that token immediately.</Text>
            <Text size="sm">Owners are intentionally protected from accidental removal in the directory.</Text>
          </Stack>
        </WorkspaceInset>
      </WorkspaceSection>
    </Stack>
  );
}
