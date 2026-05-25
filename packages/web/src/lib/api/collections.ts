import type {
  CollectionEntryResponse,
  CollectionConfig,
  CollectionEntry,
  CollectionQuery,
  CollectionQueryResult,
  ContentType,
  EntryBranchTransferApplyRequest,
  EntryBranchTransferPreview,
  GitCommit,
} from '@ori/shared';
import { request } from './core';

export const contentTypesApi = {
  async list(projectId: string): Promise<{ contentTypes: ContentType[] }> {
    return request(`/api/v1/projects/${projectId}/content-types`);
  },

  async get(projectId: string, typeId: string): Promise<{ contentType: ContentType }> {
    return request(`/api/v1/projects/${projectId}/content-types/${typeId}`);
  },

  async create(projectId: string, data: Partial<ContentType>): Promise<void> {
    return request(`/api/v1/projects/${projectId}/content-types`, { method: 'POST', body: data });
  },

  async update(projectId: string, typeId: string, data: Partial<ContentType>): Promise<void> {
    return request(`/api/v1/projects/${projectId}/content-types/${typeId}`, { method: 'PUT', body: data });
  },

  async delete(projectId: string, typeId: string): Promise<void> {
    return request(`/api/v1/projects/${projectId}/content-types/${typeId}`, { method: 'DELETE' });
  },
};

export const collectionsApi = {
  async list(projectId: string): Promise<{ collections: CollectionConfig[] }> {
    return request(`/api/v1/projects/${projectId}/schemas`);
  },

  async updateConfig(projectId: string, collections: CollectionConfig[], headers?: Record<string, string>): Promise<void> {
    return request(`/api/v1/projects/${projectId}/schemas`, { method: 'PUT', body: { schemas: collections }, headers });
  },

  async deleteCollection(projectId: string, collectionId: string, headers?: Record<string, string>): Promise<void> {
    return request(`/api/v1/projects/${projectId}/schemas/${collectionId}`, { method: 'DELETE', headers });
  },

  async listEntries(projectId: string, collectionId: string, query?: CollectionQuery): Promise<CollectionQueryResult> {
    const params = new URLSearchParams();
    if (query?.filter) params.append('filter', JSON.stringify(query.filter));
    if (query?.sort) params.append('sort', JSON.stringify(query.sort));
    if (query?.page) params.append('page', query.page.toString());
    if (query?.limit) params.append('limit', query.limit.toString());
    if (query?.search) params.append('search', query.search);
    return request(`/api/v1/projects/${projectId}/schemas/${collectionId}/entries?${params}`);
  },

  async getEntry(projectId: string, collectionId: string, id: string): Promise<CollectionEntryResponse> {
    return request(`/api/v1/projects/${projectId}/schemas/${collectionId}/entries/${id}`);
  },

  async createEntry(projectId: string, collectionId: string, data: Partial<CollectionEntry>): Promise<CollectionEntryResponse> {
    return request(`/api/v1/projects/${projectId}/schemas/${collectionId}/entries`, { method: 'POST', body: data });
  },

  async updateEntry(
    projectId: string,
    collectionId: string,
    id: string,
    data: Partial<CollectionEntry>,
    baseRevision?: string,
  ): Promise<CollectionEntryResponse> {
    return request(`/api/v1/projects/${projectId}/schemas/${collectionId}/entries/${id}`, {
      method: 'PUT',
      body: { ...data, ...(baseRevision ? { baseRevision } : {}) },
    });
  },

  async deleteEntry(projectId: string, collectionId: string, id: string, baseRevision?: string): Promise<void> {
    return request(`/api/v1/projects/${projectId}/schemas/${collectionId}/entries/${id}`, {
      method: 'DELETE',
      ...(baseRevision ? { body: { baseRevision } } : {}),
    });
  },

  async getEntryHistory(projectId: string, collectionId: string, id: string, branch?: string): Promise<{ history: GitCommit[] }> {
    const params = branch ? `?branch=${encodeURIComponent(branch)}` : '';
    return request(`/api/v1/projects/${projectId}/schemas/${collectionId}/entries/${id}/history${params}`);
  },

  async getEntryVersion(projectId: string, collectionId: string, id: string, hash: string, branch?: string): Promise<{ entry: CollectionEntry }> {
    const params = branch ? `?branch=${encodeURIComponent(branch)}` : '';
    return request(`/api/v1/projects/${projectId}/schemas/${collectionId}/entries/${id}/history/${hash}${params}`);
  },

  async previewEntryBranchTransfer(
    projectId: string,
    collectionId: string,
    id: string,
    body: { sourceBranch: string; targetBranch: string },
  ): Promise<EntryBranchTransferPreview> {
    return request(`/api/v1/projects/${projectId}/schemas/${collectionId}/entries/${id}/branch-transfer/preview`, {
      method: 'POST',
      body,
    });
  },

  async applyEntryBranchTransfer(
    projectId: string,
    collectionId: string,
    id: string,
    body: EntryBranchTransferApplyRequest,
  ): Promise<{ committed: boolean; hash: string; message: string; appliedPointerCount: number }> {
    return request(`/api/v1/projects/${projectId}/schemas/${collectionId}/entries/${id}/branch-transfer/apply`, {
      method: 'POST',
      body,
    });
  },
};
