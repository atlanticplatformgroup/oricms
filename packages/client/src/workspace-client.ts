import type {
  CreateUiGroupRequest,
  DeleteUiGroupResponse,
  GetUiGroupResponse,
  GetWorkspaceCatalogResponse,
  ListSystemSurfacesResponse,
  ListUiGroupsResponse,
  UpdateUiGroupRequest,
} from '@ori/shared';
import { OriCmsClientError } from './errors.js';

interface WorkspaceClientContext {
  mode: 'management' | 'delivery';
  projectBasePath: string;
  requestFromBase: <T>(basePath: string, path: string, init?: RequestInit) => Promise<T>;
}

function assertManagementMode(mode: WorkspaceClientContext['mode']) {
  if (mode !== 'management') {
    throw new OriCmsClientError('Workspace management is only available in management mode', 'INVALID_MODE', 400);
  }
}

export function createWorkspaceClient(context: WorkspaceClientContext) {
  return {
    async listSystemSurfaces(): Promise<ListSystemSurfacesResponse['systemSurfaces']> {
      assertManagementMode(context.mode);
      const data = await context.requestFromBase<ListSystemSurfacesResponse>(context.projectBasePath, '/system-surfaces');
      return data.systemSurfaces;
    },

    async listUiGroups(): Promise<ListUiGroupsResponse['uiGroups']> {
      assertManagementMode(context.mode);
      const data = await context.requestFromBase<ListUiGroupsResponse>(context.projectBasePath, '/ui-groups');
      return data.uiGroups;
    },

    async getUiGroup(uiGroupId: string): Promise<GetUiGroupResponse['uiGroup']> {
      assertManagementMode(context.mode);
      const data = await context.requestFromBase<GetUiGroupResponse>(
        context.projectBasePath,
        `/ui-groups/${encodeURIComponent(uiGroupId)}`,
      );
      return data.uiGroup;
    },

    async createUiGroup(input: CreateUiGroupRequest): Promise<GetUiGroupResponse['uiGroup']> {
      assertManagementMode(context.mode);
      const data = await context.requestFromBase<GetUiGroupResponse>(context.projectBasePath, '/ui-groups', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return data.uiGroup;
    },

    async updateUiGroup(uiGroupId: string, input: UpdateUiGroupRequest): Promise<GetUiGroupResponse['uiGroup']> {
      assertManagementMode(context.mode);
      const data = await context.requestFromBase<GetUiGroupResponse>(
        context.projectBasePath,
        `/ui-groups/${encodeURIComponent(uiGroupId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(input),
        },
      );
      return data.uiGroup;
    },

    async deleteUiGroup(uiGroupId: string): Promise<DeleteUiGroupResponse> {
      assertManagementMode(context.mode);
      return context.requestFromBase<DeleteUiGroupResponse>(
        context.projectBasePath,
        `/ui-groups/${encodeURIComponent(uiGroupId)}`,
        {
          method: 'DELETE',
        },
      );
    },

    async getCatalog(): Promise<GetWorkspaceCatalogResponse['catalog']> {
      assertManagementMode(context.mode);
      const data = await context.requestFromBase<GetWorkspaceCatalogResponse>(context.projectBasePath, '/workspace-catalog');
      return data.catalog;
    },
  };
}
