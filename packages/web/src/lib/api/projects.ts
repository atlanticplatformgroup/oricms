import { normalizeProjectSettingsForStorage, withLegacyPreviewEnvironment } from '@ori/shared';
import type { BranchEnvironmentMapping, Project, ProjectMember, ProjectRole } from '@ori/shared';
import { request } from './core';

function normalizeProject(project: Project): Project {
  return {
    ...project,
    settings: withLegacyPreviewEnvironment((project.settings || {}) as Project['settings'] & Record<string, unknown>),
  };
}

export const projectsApi = {
  async list(): Promise<{ projects: Array<Project & { role: ProjectRole }> }> {
    const response = await request<{ projects: Array<Project & { role: ProjectRole }> }>('/api/v1/projects');
    return {
      projects: response.projects.map((project) => ({
        ...project,
        settings: withLegacyPreviewEnvironment((project.settings || {}) as Project['settings'] & Record<string, unknown>),
      })),
    };
  },

  async get(projectId: string): Promise<{ project: Project }> {
    const response = await request<{ project: Project }>(`/api/v1/projects/${projectId}`);
    return { project: normalizeProject(response.project) };
  },

  async create(data: { name: string; slug: string; repoUrl?: string; description?: string }): Promise<{ project: Project }> {
    return request('/api/v1/projects', { method: 'POST', body: data });
  },

  async update(projectId: string, data: Partial<Project>, headers?: Record<string, string>): Promise<{ project: Project }> {
    const payload = data.settings
      ? {
          ...data,
          settings: normalizeProjectSettingsForStorage(data.settings as Project['settings'] & Record<string, unknown>),
        }
      : data;
    const response = await request<{ project: Project }>(`/api/v1/projects/${projectId}`, { method: 'PATCH', body: payload, headers });
    return { project: normalizeProject(response.project) };
  },

  async delete(projectId: string): Promise<void> {
    return request(`/api/v1/projects/${projectId}`, { method: 'DELETE' });
  },

  async listMembers(projectId: string): Promise<{ members: ProjectMember[] }> {
    return request(`/api/v1/projects/${projectId}/members`);
  },

  async inviteMember(projectId: string, email: string, role: ProjectRole, headers?: Record<string, string>): Promise<{ member?: ProjectMember; invite?: { token: string; inviteLink: string } }> {
    return request(`/api/v1/projects/${projectId}/members`, { method: 'POST', body: { email, role }, headers });
  },

  async removeMember(projectId: string, userId: string, headers?: Record<string, string>): Promise<void> {
    return request(`/api/v1/projects/${projectId}/members/${userId}`, { method: 'DELETE', headers });
  },

  async updateMemberRole(projectId: string, userId: string, role: ProjectRole, headers?: Record<string, string>): Promise<void> {
    return request(`/api/v1/projects/${projectId}/members/${userId}`, { method: 'PATCH', body: { role }, headers });
  },

  async addAgentMember(projectId: string, data: { name: string; role: ProjectRole; expiresInDays?: number }, headers?: Record<string, string>): Promise<{ member: ProjectMember; token: string }> {
    return request(`/api/v1/projects/${projectId}/members/agent`, { method: 'POST', body: data, headers });
  },

  async listBranchMappings(projectId: string): Promise<{ mappings: BranchEnvironmentMapping[]; defaults: Array<Pick<BranchEnvironmentMapping, 'branchPattern' | 'environmentId' | 'autoDeploy' | 'deployOnMerge'>> }> {
    return request(`/api/v1/projects/${projectId}/branch-mappings`);
  },

  async createBranchMapping(projectId: string, data: { branchPattern: string; environmentId?: string | null; autoDeploy?: boolean; deployOnMerge?: boolean }, headers?: Record<string, string>): Promise<{ mapping: BranchEnvironmentMapping }> {
    return request(`/api/v1/projects/${projectId}/branch-mappings`, { method: 'POST', body: data, headers });
  },

  async updateBranchMapping(projectId: string, mappingId: string, data: Partial<Pick<BranchEnvironmentMapping, 'branchPattern' | 'environmentId' | 'autoDeploy' | 'deployOnMerge'>>, headers?: Record<string, string>): Promise<{ mapping: BranchEnvironmentMapping }> {
    return request(`/api/v1/projects/${projectId}/branch-mappings/${mappingId}`, { method: 'PATCH', body: data, headers });
  },

  async deleteBranchMapping(projectId: string, mappingId: string, headers?: Record<string, string>): Promise<void> {
    return request(`/api/v1/projects/${projectId}/branch-mappings/${mappingId}`, { method: 'DELETE', headers });
  },
};
