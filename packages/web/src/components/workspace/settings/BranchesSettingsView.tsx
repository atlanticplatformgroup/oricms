import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Checkbox, Group, Modal, Select, Stack, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { Plus } from 'lucide-react';
import {
  WorkspaceEmptyState,
  WorkspaceErrorState,
  WorkspaceFieldGrid,
  WorkspaceListSurface,
  WorkspaceLoadingState,
  WorkspaceMain,
  WorkspaceMetricBadge,
  WorkspaceOperationalTable,
  WorkspaceSection,
  WorkspaceTableContainer,
} from '../../ui/WorkspacePrimitives';
import type { BranchSettingsRecord, BranchesSettingsViewProps } from './types';

type BranchAction = 'rename' | 'delete';

function getBranchActionBlockReason(branch: BranchSettingsRecord, action: BranchAction): string | null {
  if (branch.isCurrent) {
    return action === 'rename' ? 'You cannot rename the current branch' : 'You cannot delete the current branch';
  }

  if (branch.isDefault) {
    return action === 'rename' ? 'Default branches cannot be renamed' : 'Default branches cannot be deleted';
  }

  if (branch.isProtected) {
    return action === 'rename' ? 'Protected branches cannot be renamed' : 'Protected branches cannot be deleted';
  }

  return null;
}

function getEnvironmentLabel(branch: BranchSettingsRecord): string {
  if (branch.environmentLabel) return branch.environmentLabel;
  if (branch.hasPatternMapping) return 'Pattern mapped';
  return 'Unmapped';
}

function BranchActionButton(props: {
  disabledReason: string | null;
  label: string;
  color?: string;
  loading?: boolean;
  onClick: () => void;
}) {
  const button = (
    <Button
      variant="subtle"
      color={props.color}
      size="compact-sm"
      loading={props.loading}
      disabled={Boolean(props.disabledReason)}
      onClick={props.onClick}
    >
      {props.label}
    </Button>
  );

  if (!props.disabledReason) return button;

  return (
    <Tooltip label={props.disabledReason}>
      <span>{button}</span>
    </Tooltip>
  );
}

export function BranchesSettingsView({
  loading,
  error,
  branches,
  sourceBranchOptions,
  defaultSourceBranch,
  createPending,
  renamePending,
  deletePending,
  readOnly = false,
  onCreateBranch,
  onRenameBranch,
  onDeleteBranch,
  onRetry,
}: BranchesSettingsViewProps) {
  const [createOpened, setCreateOpened] = useState(false);
  const [renameBranch, setRenameBranch] = useState<BranchSettingsRecord | null>(null);
  const [deleteBranch, setDeleteBranch] = useState<BranchSettingsRecord | null>(null);
  const [createName, setCreateName] = useState('');
  const [createFrom, setCreateFrom] = useState<string | null>(defaultSourceBranch);
  const [renameName, setRenameName] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

  useEffect(() => {
    if (!createOpened) return;
    setCreateFrom(defaultSourceBranch);
  }, [createOpened, defaultSourceBranch]);

  useEffect(() => {
    if (!renameBranch) return;
    setRenameName(renameBranch.name);
  }, [renameBranch]);

  const sortedSourceOptions = useMemo(
    () => sourceBranchOptions.slice().sort((left, right) => left.label.localeCompare(right.label)),
    [sourceBranchOptions],
  );

  return (
    <WorkspaceMain>
      <WorkspaceListSurface>
        <WorkspaceSection
          title="Branch management"
          description="Create, rename, and remove repository branches without leaving project settings."
          badge={<WorkspaceMetricBadge>{`${branches.length} branches`}</WorkspaceMetricBadge>}
          actions={(
            <Button leftSection={<Plus size={14} />} onClick={() => setCreateOpened(true)} disabled={readOnly}>
              New branch
            </Button>
          )}
        >
          {loading ? (
            <WorkspaceLoadingState label="Loading branches…" />
          ) : error ? (
            <WorkspaceErrorState title="Failed to load branches" message="Branch data is unavailable right now." onRetry={onRetry} />
          ) : branches.length === 0 ? (
            <WorkspaceEmptyState title="No branches found" message="Create a branch to start working outside the default branch." />
          ) : (
            <WorkspaceTableContainer>
              <WorkspaceOperationalTable>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Environment</Table.Th>
                    <Table.Th>Last commit</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {branches.map((branch) => {
                    const renameDisabledReason = readOnly ? 'Branch settings are locked for editing' : getBranchActionBlockReason(branch, 'rename');
                    const deleteDisabledReason = readOnly ? 'Branch settings are locked for editing' : getBranchActionBlockReason(branch, 'delete');

                    return (
                      <Table.Tr key={branch.name}>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text fw={600}>{branch.name}</Text>
                            <Text size="xs" c="dimmed">
                              {branch.exactMappingCount > 0 ? `${branch.exactMappingCount} exact mapping${branch.exactMappingCount === 1 ? '' : 's'}` : 'No exact mapping'}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="wrap">
                            {branch.isCurrent ? <Badge variant="light" color="blue">Current</Badge> : null}
                            {branch.isDefault ? <Badge variant="light" color="slate">Default</Badge> : null}
                            {branch.isProtected ? <Badge variant="light" color="gray">Protected</Badge> : null}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text size="sm">{getEnvironmentLabel(branch)}</Text>
                            <Text size="xs" c="dimmed">
                              {branch.environmentLabel ? 'Exact mapping' : branch.hasPatternMapping ? 'Matched by pattern' : 'No mapping'}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          {branch.lastCommit.hash ? (
                            <Stack gap={2}>
                              <Text size="sm">{branch.lastCommit.message || branch.lastCommit.hash.slice(0, 7)}</Text>
                              <Text size="xs" c="dimmed">{branch.lastCommit.hash.slice(0, 7)}</Text>
                            </Stack>
                          ) : (
                            <Text size="sm" c="dimmed">Unavailable</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="wrap">
                            <BranchActionButton
                              label="Rename"
                              disabledReason={renameDisabledReason}
                              loading={renamePending && renameBranch?.name === branch.name}
                              onClick={() => setRenameBranch(branch)}
                            />
                            <BranchActionButton
                              label="Delete"
                              color="red"
                              disabledReason={deleteDisabledReason}
                              loading={deletePending && deleteBranch?.name === branch.name}
                              onClick={() => {
                                setDeleteConfirmed(false);
                                setDeleteBranch(branch);
                              }}
                            />
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </WorkspaceOperationalTable>
            </WorkspaceTableContainer>
          )}
        </WorkspaceSection>
      </WorkspaceListSurface>

      <Modal opened={createOpened} onClose={() => setCreateOpened(false)} title="New branch" centered>
        <Stack gap="md">
          <TextInput
            label="Branch name"
            placeholder="release/april"
            value={createName}
            disabled={readOnly}
            onChange={(event) => setCreateName(event.currentTarget.value)}
          />
          <WorkspaceFieldGrid cols={{ base: 1 }}>
            <Select
              label="Create from"
              data={sortedSourceOptions}
              value={createFrom}
              disabled={readOnly}
              onChange={setCreateFrom}
            />
          </WorkspaceFieldGrid>
          <Text size="sm" c="dimmed">
            The new branch will be created from the selected source branch.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCreateOpened(false)}>Cancel</Button>
            <Button
              loading={createPending}
              disabled={readOnly || !createName.trim() || !createFrom}
              onClick={() => {
                if (!createFrom) return;
                onCreateBranch(createName.trim(), createFrom);
                setCreateName('');
                setCreateOpened(false);
              }}
            >
              Create branch
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={Boolean(renameBranch)} onClose={() => setRenameBranch(null)} title="Rename branch" centered>
        <Stack gap="md">
          <WorkspaceFieldGrid>
            <TextInput label="Current name" value={renameBranch?.name || ''} readOnly />
            <TextInput
              label="New name"
              value={renameName}
              disabled={readOnly}
              onChange={(event) => setRenameName(event.currentTarget.value)}
            />
          </WorkspaceFieldGrid>
          <Alert color="blue" title="Impact summary">
            {renameBranch ? `Affected branch mappings: ${renameBranch.exactMappingCount}. Exact branch mappings will be updated automatically.` : 'Rename impact will appear here.'}
          </Alert>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRenameBranch(null)}>Cancel</Button>
            <Button
              loading={renamePending}
              disabled={readOnly || !renameBranch || !renameName.trim() || renameName.trim() === renameBranch.name}
              onClick={() => {
                if (!renameBranch) return;
                onRenameBranch(renameBranch.name, renameName.trim());
                setRenameBranch(null);
              }}
            >
              Rename branch
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={Boolean(deleteBranch)} onClose={() => setDeleteBranch(null)} title="Delete branch" centered>
        <Stack gap="md">
          <Text>
            {deleteBranch ? `Delete branch ${deleteBranch.name}?` : 'Delete this branch?'}
          </Text>
          <Alert color="red" title="Impact summary">
            {deleteBranch ? `Affected branch mappings: ${deleteBranch.exactMappingCount}. Exact branch mappings will be removed automatically.` : 'Branch deletion impact will appear here.'}
          </Alert>
          <Checkbox
            label="I understand this will permanently delete the branch"
            checked={deleteConfirmed}
            disabled={readOnly}
            onChange={(event) => setDeleteConfirmed(event.currentTarget.checked)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteBranch(null)}>Cancel</Button>
            <Button
              color="red"
              loading={deletePending}
              disabled={readOnly || !deleteBranch || !deleteConfirmed}
              onClick={() => {
                if (!deleteBranch) return;
                onDeleteBranch(deleteBranch.name);
                setDeleteBranch(null);
                setDeleteConfirmed(false);
              }}
            >
              Delete branch
            </Button>
          </Group>
        </Stack>
      </Modal>
    </WorkspaceMain>
  );
}
