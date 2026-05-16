import { useMemo, useState } from 'react';
import { Alert, Button, Group, Text } from '@mantine/core';
import type { ProjectMember, ProjectRole, ResourceLock } from '@ori/shared';
import {
  useAddAgentMember,
  useInviteMember,
  useMembers,
  useRemoveMember,
  useUpdateMemberRole,
} from '../../hooks/queries/useProjectQueries';
import { useBrowseSearch } from '../../hooks/useBrowseSearch';
import {
  WorkspaceHeader,
  WorkspaceMain,
  WorkspaceMetricBadge,
  WorkspacePage,
} from '../ui/WorkspacePrimitives';
import { AddMemberModal } from './members/AddMemberModal';
import { AgentTokenModal } from './members/AgentTokenModal';
import { MembersDirectoryTable } from './members/MembersDirectoryTable';
import { locksApi } from '../../lib/api/locks';
import { ApiError } from '../../lib/api/core';

interface MembersWorkspaceProps {
  projectId: string;
  selectedView: string;
  selectedLabel?: string;
  selectedDescription?: string;
}

export type AddMemberMode = 'human' | 'agent';

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
] satisfies Array<{ value: ProjectRole; label: string }>;

export function matchesView(member: ProjectMember, view: string): boolean {
  if (view === 'humans') return member.userType === 'HUMAN';
  if (view === 'agents') return member.userType === 'AGENT';
  return true;
}

export function MembersWorkspace({
  projectId,
  selectedView,
  selectedLabel,
  selectedDescription,
}: MembersWorkspaceProps) {
  const [addMemberOpened, setAddMemberOpened] = useState(false);
  const [addMode, setAddMode] = useState<AddMemberMode>('human');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectRole>('editor');
  const [agentName, setAgentName] = useState('');
  const [agentRole, setAgentRole] = useState<ProjectRole>('viewer');
  const [agentExpiresInDays, setAgentExpiresInDays] = useState('30');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [tokenModalOpened, setTokenModalOpened] = useState(false);
  const [blockingLock, setBlockingLock] = useState<ResourceLock | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);
  const [lockActionPending, setLockActionPending] = useState(false);
  const search = useBrowseSearch();

  const membersQuery = useMembers(projectId);
  const inviteMember = useInviteMember(projectId);
  const updateMemberRole = useUpdateMemberRole(projectId);
  const removeMember = useRemoveMember(projectId);
  const addAgentMember = useAddAgentMember(projectId);
  const members = useMemo(() => ((membersQuery.data?.members || []) as ProjectMember[]), [membersQuery.data?.members]);
  const filteredByView = useMemo(() => members.filter((member) => matchesView(member, selectedView)), [members, selectedView]);
  const filteredMembers = useMemo(() => {
    const query = search.debouncedValue.trim().toLowerCase();
    if (!query) return filteredByView;
    return filteredByView.filter((member) =>
      [member.user.name || '', member.user.email || '', member.role, member.userType]
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [filteredByView, search.debouncedValue]);

  const counts = useMemo(
    () => ({
      total: members.length,
      humans: members.filter((member) => member.userType === 'HUMAN').length,
      agents: members.filter((member) => member.userType === 'AGENT').length,
      owners: members.filter((member) => member.role === 'owner').length,
    }),
    [members],
  );

  const openAddModal = (mode: AddMemberMode) => {
    setAddMode(mode);
    setAddMemberOpened(true);
  };

  const resetAddForm = () => {
    setInviteEmail('');
    setInviteRole('editor');
    setAgentName('');
    setAgentRole('viewer');
    setAgentExpiresInDays('30');
  };

  const captureLockError = (error: unknown) => {
    if (error instanceof ApiError && error.code === 'RESOURCE_LOCKED') {
      const nextBlockingLock: ResourceLock = {
        id: 'blocking-lock',
        projectId,
        resourceType: 'members',
        resourceId: 'project-members',
        mode: 'hard',
        holderType: error.details?.holderType?.[0] === 'agent' ? 'agent' : 'human',
        holderId: '',
        holderName: error.details?.holderName?.[0] || 'Another editor',
        sessionId: '',
        reason: 'configuring',
        acquiredAt: error.details?.lockedAt?.[0] || new Date().toISOString(),
        expiresAt: error.details?.expiresAt?.[0] || new Date().toISOString(),
      };
      setBlockingLock(nextBlockingLock);
      setLockError(null);
      return;
    }

    setBlockingLock(null);
    setLockError(error instanceof Error ? error.message : 'Failed to acquire member lock');
  };

  const runWithMemberLock = async <T,>(action: (headers: Record<string, string>) => Promise<T>): Promise<T> => {
    setBlockingLock(null);
    setLockError(null);
    setLockActionPending(true);

    let acquiredLock: { id: string } | null = null;
    let lockToken: string | undefined;

    try {
      const response = await locksApi.acquire(projectId, {
        resourceType: 'members',
        resourceId: 'project-members',
        mode: 'hard',
        reason: 'configuring',
      });
      acquiredLock = response.lock;
      lockToken = response.lockToken;

      const result = await action(locksApi.mutationHeaders(lockToken));
      setBlockingLock(null);
      setLockError(null);
      return result;
    } catch (error) {
      captureLockError(error);
      throw error;
    } finally {
      if (acquiredLock) {
        void locksApi.release(projectId, acquiredLock.id, lockToken).catch(() => {
          // Best effort release after mutation.
        });
      }
      setLockActionPending(false);
    }
  };

  const isBusy = lockActionPending || inviteMember.isPending || updateMemberRole.isPending || removeMember.isPending || addAgentMember.isPending;

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      await runWithMemberLock((headers) => inviteMember.mutateAsync({ email: inviteEmail.trim(), role: inviteRole, headers }));
    } catch {
      return;
    }
    resetAddForm();
    setAddMemberOpened(false);
  };

  const handleAddAgent = async () => {
    if (!agentName.trim()) return;
    let result;
    try {
      result = await runWithMemberLock((headers) => addAgentMember.mutateAsync({
        name: agentName.trim(),
        role: agentRole,
        expiresInDays: agentExpiresInDays ? parseInt(agentExpiresInDays, 10) : undefined,
        headers,
      }));
    } catch {
      return;
    }
    setGeneratedToken(result.token);
    setTokenModalOpened(true);
    resetAddForm();
    setAddMemberOpened(false);
  };

  return (
    <WorkspacePage>
      <WorkspaceHeader
        title="Members"
        description={selectedDescription || 'Manage people and AI service accounts through one shared membership model.'}
        meta={selectedLabel ? <Text size="sm" c="dimmed">{selectedLabel}</Text> : undefined}
        actions={
          <Group gap="xs">
            <WorkspaceMetricBadge>{`${counts.total} members`}</WorkspaceMetricBadge>
            <Button variant="default" onClick={() => openAddModal('human')} disabled={isBusy}>Invite human</Button>
            <Button onClick={() => openAddModal('agent')} disabled={isBusy}>Add AI agent</Button>
          </Group>
        }
      />

      {blockingLock ? (
        <Alert color="yellow" title={blockingLock.holderName ? `Locked by ${blockingLock.holderName}` : 'Members locked'}>
          {blockingLock.holderName
            ? `${blockingLock.holderName} is editing project members. Try again after their editing session ends.`
            : 'Project members are currently locked for editing.'}
        </Alert>
      ) : lockError ? (
        <Alert color="red" title="Unable to edit members">{lockError}</Alert>
      ) : null}

      <WorkspaceMain>
        <MembersDirectoryTable
          members={filteredMembers}
          loading={membersQuery.isLoading}
          error={membersQuery.isError}
          search={search.value}
          onSearchChange={search.setValue}
          selectedView={selectedView}
          onRetry={() => void membersQuery.refetch()}
          readOnly={isBusy}
          onUpdateRole={(userId, role) => {
            void runWithMemberLock((headers) => updateMemberRole.mutateAsync({ userId, role, headers })).catch(() => {});
          }}
          onRemoveMember={(member) => {
            if (!window.confirm(`Remove ${member.user.name || member.user.email} from this project?`)) return;
            void runWithMemberLock((headers) => removeMember.mutateAsync({ userId: member.userId, headers })).catch(() => {});
          }}
        />
      </WorkspaceMain>

      <AddMemberModal
        opened={addMemberOpened}
        onClose={() => setAddMemberOpened(false)}
        mode={addMode}
        onModeChange={setAddMode}
        inviteEmail={inviteEmail}
        onInviteEmailChange={setInviteEmail}
        inviteRole={inviteRole}
        onInviteRoleChange={setInviteRole}
        agentName={agentName}
        onAgentNameChange={setAgentName}
        agentRole={agentRole}
        onAgentRoleChange={setAgentRole}
        agentExpiresInDays={agentExpiresInDays}
        onAgentExpiresInDaysChange={setAgentExpiresInDays}
        invitePending={inviteMember.isPending}
        addAgentPending={addAgentMember.isPending}
        readOnly={isBusy}
        onInvite={() => void handleInvite()}
        onAddAgent={() => void handleAddAgent()}
      />

      <AgentTokenModal
        opened={tokenModalOpened && Boolean(generatedToken)}
        token={generatedToken}
        onClose={() => {
          setTokenModalOpened(false);
          setGeneratedToken(null);
        }}
      />
    </WorkspacePage>
  );
}
