import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gitApi } from '../../lib/api/git';
import { useToast } from '../../contexts/ToastContext';

export const schemaQueryKeys = {
  all: ['schemas'] as const,
  lists: (projectId: string) => [...schemaQueryKeys.all, 'list', projectId] as const,
  types: (projectId: string) => [...schemaQueryKeys.all, 'types', projectId] as const,
  components: (projectId: string) => [...schemaQueryKeys.all, 'components', projectId] as const,
  detail: (projectId: string, path: string) => [...schemaQueryKeys.all, 'detail', projectId, path] as const,
  history: (projectId: string, path: string) => [...schemaQueryKeys.all, 'history', projectId, path] as const,
};

export function useTypeSchemas(projectId?: string) {
  return useQuery({
    queryKey: schemaQueryKeys.types(projectId!),
    queryFn: () => gitApi.getTypeSchemas(projectId!),
    enabled: !!projectId,
  });
}

export function useComponentSchemas(projectId?: string) {
  return useQuery({
    queryKey: schemaQueryKeys.components(projectId!),
    queryFn: () => gitApi.getComponentSchemas(projectId!),
    enabled: !!projectId,
  });
}

export function useSchema(projectId?: string, path?: string | null) {
  return useQuery({
    queryKey: schemaQueryKeys.detail(projectId!, path!),
    queryFn: () => gitApi.getSchema(projectId!, path!),
    enabled: !!projectId && !!path,
  });
}

export function useSchemaHistory(projectId?: string, path?: string | null, limit = 20, enabled = true) {
  return useQuery({
    queryKey: schemaQueryKeys.history(projectId!, path!),
    queryFn: () => gitApi.getHistory(projectId!, limit, path!),
    enabled: enabled && !!projectId && !!path,
  });
}

export function useSaveSchema(projectId?: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ path, content, message }: { path: string; content: string; message?: string }) => 
      gitApi.saveSchema(projectId!, path, content, message),
    onSuccess: (_, variables) => {
      showToast('Schema saved successfully', 'success');
      void queryClient.invalidateQueries({ queryKey: schemaQueryKeys.detail(projectId!, variables.path) });
      void queryClient.invalidateQueries({ queryKey: schemaQueryKeys.types(projectId!) });
      void queryClient.invalidateQueries({ queryKey: schemaQueryKeys.components(projectId!) });
      void queryClient.invalidateQueries({ queryKey: schemaQueryKeys.history(projectId!, variables.path) });
    },
    onError: () => {
      showToast('Failed to save schema', 'error');
    }
  });
}

export function useDeleteSchema(projectId?: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (path: string) => gitApi.deleteSchema(projectId!, path),
    onSuccess: () => {
      showToast('Schema deleted successfully', 'success');
      void queryClient.invalidateQueries({ queryKey: schemaQueryKeys.types(projectId!) });
      void queryClient.invalidateQueries({ queryKey: schemaQueryKeys.components(projectId!) });
    },
    onError: () => {
      showToast('Failed to delete schema', 'error');
    }
  });
}
