import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProjectRole } from '@ori/shared';
import { projectsApi } from '../../lib/api/projects';
import { useToast } from '../../contexts/ToastContext';

export const projectQueryKeys = {
  all: ['projects'] as const,
  list: () => [...projectQueryKeys.all, 'list'] as const,
  detail: (projectId: string) => [...projectQueryKeys.all, 'detail', projectId] as const,
  branchMappings: (projectId: string) => [...projectQueryKeys.all, 'branchMappings', projectId] as const,
  members: (projectId: string) => [...projectQueryKeys.all, 'members', projectId] as const,
};

export function useProjectData(projectId?: string) {
  return useQuery({
    queryKey: projectQueryKeys.detail(projectId!),
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  });
}

export function useUpdateProject(projectId?: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (data: { name?: string; description?: string; settings?: any }) => 
      projectsApi.update(projectId!, data),
    onSuccess: () => {
      showToast('Settings saved', 'success');
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.detail(projectId!) });
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.list() });
    },
    onError: () => {
      showToast('Failed to save settings', 'error');
    }
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (projectId: string) => projectsApi.delete(projectId),
    onSuccess: () => {
      showToast('Project deleted', 'success');
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.list() });
    },
    onError: () => {
      showToast('Failed to delete project', 'error');
    }
  });
}

export function useBranchMappings(projectId?: string) {
  return useQuery({
    queryKey: projectQueryKeys.branchMappings(projectId!),
    queryFn: () => projectsApi.listBranchMappings(projectId!),
    enabled: !!projectId,
  });
}

export function useCreateBranchMapping(projectId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => projectsApi.createBranchMapping(projectId!, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.branchMappings(projectId!) });
    },
  });
}

export function useUpdateBranchMapping(projectId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mappingId, data }: { mappingId: string, data: any }) => 
      projectsApi.updateBranchMapping(projectId!, mappingId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.branchMappings(projectId!) });
    },
  });
}

export function useDeleteBranchMapping(projectId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mappingId: string) => projectsApi.deleteBranchMapping(projectId!, mappingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.branchMappings(projectId!) });
    },
  });
}

export function useMembers(projectId?: string) {
  return useQuery({
    queryKey: projectQueryKeys.members(projectId!),
    queryFn: () => projectsApi.listMembers(projectId!),
    enabled: !!projectId,
  });
}

export function useInviteMember(projectId?: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ email, role, headers }: { email: string; role: ProjectRole; headers?: Record<string, string> }) =>
      projectsApi.inviteMember(projectId!, email, role, headers),
    onSuccess: () => {
      showToast('Invitation sent', 'success');
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.members(projectId!) });
    },
    onError: () => {
      showToast('Failed to send invitation', 'error');
    },
  });
}

export function useUpdateMemberRole(projectId?: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ userId, role, headers }: { userId: string; role: ProjectRole; headers?: Record<string, string> }) =>
      projectsApi.updateMemberRole(projectId!, userId, role, headers),
    onSuccess: () => {
      showToast('Role updated', 'success');
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.members(projectId!) });
    },
    onError: () => {
      showToast('Failed to update role', 'error');
    },
  });
}

export function useRemoveMember(projectId?: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ userId, headers }: { userId: string; headers?: Record<string, string> }) => projectsApi.removeMember(projectId!, userId, headers),
    onSuccess: () => {
      showToast('Member removed', 'success');
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.members(projectId!) });
    },
    onError: () => {
      showToast('Failed to remove member', 'error');
    },
  });
}

export function useAddAgentMember(projectId?: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (data: { name: string; role: ProjectRole; expiresInDays?: number; headers?: Record<string, string> }) =>
      projectsApi.addAgentMember(projectId!, { name: data.name, role: data.role, ...(data.expiresInDays !== undefined ? { expiresInDays: data.expiresInDays } : {}) }, data.headers),
    onSuccess: () => {
      showToast('AI Agent created and ready to use', 'success');
      void queryClient.invalidateQueries({ queryKey: projectQueryKeys.members(projectId!) });
    },
    onError: () => {
      showToast('Failed to add AI Agent', 'error');
    },
  });
}
