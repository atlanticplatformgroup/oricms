import type {
  ResourceCollectionDetail,
  ResourceRecordDetail,
  ResourceRecordSummary,
  ResourceSchemaDefinition,
} from '@ori/shared';
import { request } from './core';

export const resourcesApi = {
  async list(projectId: string): Promise<{ resources: ResourceCollectionDetail[] }> {
    return request(`/api/v1/projects/${projectId}/resources`);
  },

  async get(projectId: string, resourceCollectionId: string): Promise<{ resource: ResourceCollectionDetail }> {
    return request(`/api/v1/projects/${projectId}/resources/${encodeURIComponent(resourceCollectionId)}`);
  },

  async listRecords(
    projectId: string,
    resourceCollectionId: string,
    options?: { page?: number; limit?: number },
  ): Promise<{ records: ResourceRecordSummary[]; pagination: { page: number; limit: number; total: number; pageCount: number } }> {
    const qs = new URLSearchParams();
    if (options?.page) qs.append('page', String(options.page));
    if (options?.limit) qs.append('limit', String(options.limit));
    return request(`/api/v1/projects/${projectId}/resources/${encodeURIComponent(resourceCollectionId)}/records?${qs}`);
  },

  async getRecord(
    projectId: string,
    resourceCollectionId: string,
    recordId: string,
  ): Promise<{ record: ResourceRecordDetail }> {
    return request(
      `/api/v1/projects/${projectId}/resources/${encodeURIComponent(resourceCollectionId)}/records/${encodeURIComponent(recordId)}`,
    );
  },

  async getSchema(
    projectId: string,
    resourceCollectionId: string,
  ): Promise<{ schema: ResourceSchemaDefinition }> {
    return request(`/api/v1/projects/${projectId}/resources/${encodeURIComponent(resourceCollectionId)}/schema`);
  },

  async getPolicy(
    projectId: string,
    resourceCollectionId: string,
  ): Promise<{ policy: ResourceCollectionDetail['policySummary']; capabilities: ResourceCollectionDetail['capabilities'] }> {
    return request(`/api/v1/projects/${projectId}/resources/${encodeURIComponent(resourceCollectionId)}/policy`);
  },
};
