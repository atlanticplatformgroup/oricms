import type { AgentWriteConfig } from '@ori/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentApi } from '../../lib/api/agent';
import { useToast } from '../../contexts/ToastContext';

export const agentQueryKeys = {
  all: ['agent'] as const,
  writeConfigs: (projectId: string) => [...agentQueryKeys.all, 'writeConfigs', projectId] as const,
  changes: (projectId: string, status: string) => [...agentQueryKeys.all, 'changes', projectId, status] as const,
};

export function useAgentWriteConfigs(projectId?: string) {
  return useQuery({
    queryKey: agentQueryKeys.writeConfigs(projectId!),
    queryFn: () => agentApi.getWriteConfigs(projectId!),
    enabled: !!projectId,
  });
}

export function useAgentChanges(projectId?: string, status: string = 'PENDING') {
  return useQuery({
    queryKey: agentQueryKeys.changes(projectId!, status),
    queryFn: () => agentApi.getChanges(projectId!, status),
    enabled: !!projectId,
  });
}

export function useUpdateAgentWriteConfig(projectId?: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ collectionName, config }: { collectionName: string; config: Partial<AgentWriteConfig> }) => 
      agentApi.updateWriteConfig(projectId!, collectionName, config),
    onSuccess: () => {
      showToast('Config saved', 'success');
      void queryClient.invalidateQueries({ queryKey: agentQueryKeys.writeConfigs(projectId!) });
    },
    onError: () => {
      showToast('Failed to save config', 'error');
    },
  });
}

export function usePromoteAgentChanges(projectId?: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ changeIds, targetBranch = 'main' }: { changeIds: string[]; targetBranch?: string }) => 
      agentApi.promoteChanges(projectId!, changeIds, targetBranch),
    onSuccess: (data) => {
      showToast(`Promoted ${data.promoted} changes to production`, 'success');
      void queryClient.invalidateQueries({ queryKey: agentQueryKeys.changes(projectId!, 'PENDING') });
    },
  });
}
