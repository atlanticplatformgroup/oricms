import type {
  CreateUiGroupRequest,
  DeleteUiGroupResponse,
  GetUiGroupResponse,
  GetWorkspaceCatalogResponse,
  ListSystemSurfacesResponse,
  ListUiGroupsResponse,
  UpdateUiGroupRequest,
} from '@ori/shared';
import { request } from './core';

export const workspaceApi = {
  async listSystemSurfaces(projectId: string): Promise<ListSystemSurfacesResponse> {
    return request(`/api/v1/projects/${projectId}/system-surfaces`);
  },

  async listUiGroups(projectId: string): Promise<ListUiGroupsResponse> {
    return request(`/api/v1/projects/${projectId}/ui-groups`);
  },

  async getUiGroup(projectId: string, uiGroupId: string): Promise<GetUiGroupResponse> {
    return request(`/api/v1/projects/${projectId}/ui-groups/${encodeURIComponent(uiGroupId)}`);
  },

  async createUiGroup(projectId: string, body: CreateUiGroupRequest): Promise<GetUiGroupResponse> {
    return request(`/api/v1/projects/${projectId}/ui-groups`, {
      method: 'POST',
      body,
    });
  },

  async updateUiGroup(
    projectId: string,
    uiGroupId: string,
    body: UpdateUiGroupRequest,
  ): Promise<GetUiGroupResponse> {
    return request(`/api/v1/projects/${projectId}/ui-groups/${encodeURIComponent(uiGroupId)}`, {
      method: 'PATCH',
      body,
    });
  },

  async deleteUiGroup(projectId: string, uiGroupId: string): Promise<DeleteUiGroupResponse> {
    return request(`/api/v1/projects/${projectId}/ui-groups/${encodeURIComponent(uiGroupId)}`, {
      method: 'DELETE',
    });
  },

  async getCatalog(projectId: string): Promise<GetWorkspaceCatalogResponse> {
    return request(`/api/v1/projects/${projectId}/workspace-catalog`);
  },

  async getWorkspaceCatalog(projectId: string): Promise<GetWorkspaceCatalogResponse> {
    return request(`/api/v1/projects/${projectId}/workspace-catalog`);
  },
};
