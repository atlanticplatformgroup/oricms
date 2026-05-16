import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { buildsApi } from '../../lib/api/builds';
import { useToast } from '../../contexts/ToastContext';

export const buildQueryKeys = {
  all: ['builds'] as const,
  list: (projectId: string, options?: any) => [...buildQueryKeys.all, 'list', projectId, options] as const,
  summary: (projectId: string) => [...buildQueryKeys.all, 'summary', projectId] as const,
  detail: (projectId: string, buildId: string) => [...buildQueryKeys.all, 'detail', projectId, buildId] as const,
};

export function useBuildsQuery(projectId?: string, options?: any) {
  return useQuery({
    queryKey: buildQueryKeys.list(projectId!, options),
    queryFn: () => buildsApi.list(projectId!, options),
    enabled: !!projectId,
    refetchInterval: (query) => {
      const data = query.state.data as any;
      // Poll if any build is running or pending
      const hasActive = data?.builds?.some((b: any) => b.status === 'running' || b.status === 'pending');
      return hasActive ? 5000 : false;
    }
  });
}

export function useBuildSummary(projectId?: string) {
  return useQuery({
    queryKey: buildQueryKeys.summary(projectId!),
    queryFn: () => buildsApi.getSummary(projectId!),
    enabled: !!projectId,
    refetchInterval: 5000, // Always poll summary for status updates
  });
}

export function useTriggerBuild(projectId?: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: () => buildsApi.trigger(projectId!),
    onSuccess: () => {
      showToast('Build triggered successfully', 'success');
      void queryClient.invalidateQueries({ queryKey: buildQueryKeys.all });
    },
    onError: (error: any) => {
      showToast(error.message || 'Failed to trigger build', 'error');
    }
  });
}

export function useCancelBuild(projectId?: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (buildId: string) => buildsApi.cancel(projectId!, buildId),
    onSuccess: () => {
      showToast('Build cancelled', 'success');
      void queryClient.invalidateQueries({ queryKey: buildQueryKeys.all });
    },
    onError: (error: any) => {
      showToast(error.message || 'Failed to cancel build', 'error');
    }
  });
}
