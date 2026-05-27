import { Loader, Menu } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, GitBranch as GitBranchIcon, Settings } from 'lucide-react';
import { gitApi } from '../../lib/api/git';
import { WorkspaceToolbarButton } from './WorkspacePrimitives';

interface WorkspaceBranchSwitcherProps {
  projectId: string;
  currentBranchName: string;
  onBeforeSwitch: () => boolean;
  onSelectBranch: (branchName: string) => void;
  onNavigateToBranches: () => void;
  compact?: boolean;
}

export function WorkspaceBranchSwitcher({
  projectId,
  currentBranchName,
  onBeforeSwitch,
  onSelectBranch,
  onNavigateToBranches,
  compact = false,
}: WorkspaceBranchSwitcherProps) {
  const branchesQuery = useQuery({
    queryKey: ['workspace-branch-switcher', projectId],
    queryFn: () => gitApi.getBranches(projectId),
    enabled: Boolean(projectId),
  });

  const branches = branchesQuery.data?.branches || [];
  const sortedBranches = branches.slice().sort((left, right) => left.name.localeCompare(right.name));

  return (
    <Menu position="bottom-end" shadow="md" width={240}>
      <Menu.Target>
        <WorkspaceToolbarButton
          rightSection={branchesQuery.isLoading ? <Loader size={14} /> : <ChevronDown size={14} />}
          leftSection={<GitBranchIcon size={14} />}
          aria-label={`Branch: ${currentBranchName}`}
          data-testid="branch-switcher"
        >
          {compact ? currentBranchName : `Branch: ${currentBranchName}`}
        </WorkspaceToolbarButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Switch branch</Menu.Label>
        {sortedBranches.map((branch) => (
          <Menu.Item
            key={branch.name}
            leftSection={branch.name === currentBranchName ? <Check size={14} /> : undefined}
            disabled={branch.name === currentBranchName}
            onClick={() => {
              if (!onBeforeSwitch()) return;
              onSelectBranch(branch.name);
            }}
          >
            {branch.name}
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item
          leftSection={<Settings size={14} />}
          onClick={onNavigateToBranches}
        >
          Manage branches
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
