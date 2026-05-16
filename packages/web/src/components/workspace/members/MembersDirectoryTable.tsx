import { Badge, Group, Select, Stack, Table, Text, ThemeIcon } from '@mantine/core';
import type { ProjectMember, ProjectRole } from '@ori/shared';
import { Bot, UserRound } from 'lucide-react';
import { ROLE_OPTIONS } from '../MembersWorkspace';
import { WorkspaceSearchField } from '../../ui/WorkspaceSearchField';
import { WorkspaceEmptyState, WorkspaceErrorState, WorkspaceLoadingState, WorkspaceMetricBadge, WorkspaceOperationalTable, WorkspaceSection, WorkspaceTableContainer, WorkspaceTableToolbarInset, WorkspaceToolbar } from '../../ui/WorkspacePrimitives';

interface MembersDirectoryTableProps {
  members: ProjectMember[];
  loading: boolean;
  error: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  selectedView: string;
  readOnly?: boolean;
  onUpdateRole: (userId: string, role: ProjectRole) => void;
  onRemoveMember: (member: ProjectMember) => void;
  onRetry?: () => void;
}

function getViewLabel(selectedView: string): string {
  if (selectedView === 'humans') return 'Humans';
  if (selectedView === 'agents') return 'AI agents';
  return 'All members';
}

export function MembersDirectoryTable({
  members,
  loading,
  error,
  search,
  onSearchChange,
  selectedView,
  readOnly = false,
  onUpdateRole,
  onRemoveMember,
  onRetry,
}: MembersDirectoryTableProps) {
  return (
    <WorkspaceSection
      title="Directory"
      description="Review access, adjust roles, and remove members without leaving the workspace."
      badge={<WorkspaceMetricBadge>{`${members.length} visible`}</WorkspaceMetricBadge>}
    >
      <WorkspaceTableToolbarInset>
        <WorkspaceToolbar
          controls={(
            <WorkspaceSearchField
              ariaLabel="Search members"
              placeholder="Search members"
              value={search}
              onChange={onSearchChange}
              maw={260}
            />
          )}
          actions={<Text size="sm" c="dimmed">{getViewLabel(selectedView)}</Text>}
        />
      </WorkspaceTableToolbarInset>

      {loading ? (
        <WorkspaceLoadingState label="Loading members…" />
      ) : error ? (
        <WorkspaceErrorState title="Failed to load members" message="Member data is unavailable right now." onRetry={onRetry} />
      ) : members.length === 0 ? (
        <WorkspaceEmptyState title="No members" message="No one matches the current member view or search." />
      ) : (
        <WorkspaceTableContainer>
        <WorkspaceOperationalTable>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Member</Table.Th>
              <Table.Th>Access</Table.Th>
              <Table.Th>Joined</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {members.map((member) => (
              <Table.Tr key={member.id}>
                <Table.Td>
                  <Group gap="sm" wrap="nowrap" align="flex-start">
                    <ThemeIcon variant="light" color={member.userType === 'HUMAN' ? 'blue' : 'yellow'}>
                      {member.userType === 'HUMAN' ? <UserRound size={14} /> : <Bot size={14} />}
                    </ThemeIcon>
                    <Stack gap={0} style={{ minWidth: 0 }}>
                      <Text fw={600}>{member.user.name || member.user.email}</Text>
                      <Text size="xs" c="dimmed">{member.user.email}</Text>
                    </Stack>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Stack gap={4}>
                    <Group gap="xs" wrap="wrap">
                      <Badge variant="light" color={member.userType === 'HUMAN' ? 'blue' : 'yellow'}>
                        {member.userType === 'HUMAN' ? 'Human' : 'AI Agent'}
                      </Badge>
                      {member.role === 'owner' ? (
                        <Badge variant="light" color="blue">Owner</Badge>
                      ) : null}
                    </Group>
                    {member.role === 'owner' ? (
                      <Text size="sm" c="dimmed">Full project control</Text>
                    ) : (
                      <Select
                        size="xs"
                        value={member.role}
                        data={ROLE_OPTIONS}
                        aria-label={`Role for ${member.user.email}`}
                        disabled={readOnly}
                        onChange={(value) => {
                          if (!value) return;
                          onUpdateRole(member.userId, value as ProjectRole);
                        }}
                      />
                    )}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Stack gap={0}>
                    <Text size="sm">{new Date(member.joinedAt || member.createdAt).toLocaleDateString()}</Text>
                    <Text size="xs" c="dimmed">{member.userType === 'AGENT' ? 'Service account' : 'Member'}</Text>
                  </Stack>
                </Table.Td>
                <Table.Td>
                  {member.role !== 'owner' ? (
                    <Text
                      component="button"
                      type="button"
                      c="red"
                      size="sm"
                      aria-disabled={readOnly}
                      style={{ background: 'transparent', border: 0, padding: 0, cursor: readOnly ? 'not-allowed' : 'pointer', opacity: readOnly ? 0.6 : 1 }}
                      onClick={() => {
                        if (readOnly) return;
                        onRemoveMember(member);
                      }}
                    >
                      Remove
                    </Text>
                  ) : (
                    <Text size="sm" c="dimmed">Protected</Text>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </WorkspaceOperationalTable>
        </WorkspaceTableContainer>
      )}
    </WorkspaceSection>
  );
}
