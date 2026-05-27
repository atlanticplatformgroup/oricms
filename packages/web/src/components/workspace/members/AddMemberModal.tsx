import { Button, Group, Modal, NumberInput, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core';
import { Mail } from 'lucide-react';
import type { ProjectRole } from '@ori/shared';
import { useMediaQuery } from '@mantine/hooks';
import { WorkspaceFieldGrid } from '../../ui/WorkspacePrimitives';
import type { AddMemberMode } from '../MembersWorkspace';
import { ROLE_OPTIONS } from '../MembersWorkspace';

interface AddMemberModalProps {
  opened: boolean;
  onClose: () => void;
  mode: AddMemberMode;
  onModeChange: (mode: AddMemberMode) => void;
  inviteEmail: string;
  onInviteEmailChange: (value: string) => void;
  inviteRole: ProjectRole;
  onInviteRoleChange: (value: ProjectRole) => void;
  agentName: string;
  onAgentNameChange: (value: string) => void;
  agentRole: ProjectRole;
  onAgentRoleChange: (value: ProjectRole) => void;
  agentExpiresInDays: string;
  onAgentExpiresInDaysChange: (value: string) => void;
  invitePending: boolean;
  addAgentPending: boolean;
  readOnly?: boolean;
  onInvite: () => void;
  onAddAgent: () => void;
}

export function AddMemberModal(props: AddMemberModalProps) {
  const isMobile = useMediaQuery('(max-width: 48em)');

  return (
    <Modal opened={props.opened} onClose={props.onClose} title="Add member" centered fullScreen={isMobile}>
      <Stack gap="sm">
        <SegmentedControl
          value={props.mode}
          disabled={props.readOnly}
          onChange={(value) => props.onModeChange(value === 'agent' ? 'agent' : 'human')}
          data={[
            { label: 'Invite human', value: 'human' },
            { label: 'Add AI agent', value: 'agent' },
          ]}
        />

        {props.mode === 'human' ? (
          <Stack gap="sm">
            <TextInput
              label="Email"
              leftSection={<Mail size={14} />}
              value={props.inviteEmail}
              disabled={props.readOnly}
              onChange={(event) => props.onInviteEmailChange(event.currentTarget.value)}
            />
            <Select
              label="Role"
              data={ROLE_OPTIONS}
              value={props.inviteRole}
              disabled={props.readOnly}
              onChange={(value) => props.onInviteRoleChange((value as ProjectRole) || 'editor')}
            />
            <Text size="sm" c="dimmed">Existing users are added immediately. New users receive an email invitation.</Text>
            <Group justify="flex-end">
              <Button onClick={props.onInvite} loading={props.invitePending} disabled={props.readOnly}>Send invite</Button>
            </Group>
          </Stack>
        ) : (
          <Stack gap="sm">
            <TextInput label="Agent name" value={props.agentName} disabled={props.readOnly} onChange={(event) => props.onAgentNameChange(event.currentTarget.value)} />
            <WorkspaceFieldGrid>
              <Select
                label="Role"
                data={ROLE_OPTIONS}
                value={props.agentRole}
                disabled={props.readOnly}
                onChange={(value) => props.onAgentRoleChange((value as ProjectRole) || 'viewer')}
              />
            </WorkspaceFieldGrid>
            <NumberInput
              label="Token expires in days"
              min={1}
              disabled={props.readOnly}
              value={props.agentExpiresInDays ? Number(props.agentExpiresInDays) : ''}
              onChange={(value) => props.onAgentExpiresInDaysChange(value ? String(value) : '')}
            />
            <Text size="sm" c="dimmed">Service accounts for agents are created automatically and bootstrapped for immediate project access. The generated token is shown only once after creation.</Text>
            <Group justify="flex-end">
              <Button onClick={props.onAddAgent} loading={props.addAgentPending} disabled={props.readOnly}>Create agent</Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
