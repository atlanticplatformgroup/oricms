import type {
  ResourceCollectionDetail,
  ResourceRecordDetail,
  ResourceRecordSummary,
  ResourceSchemaDefinition,
} from '@ori/shared';
import { OriCmsClientError } from './errors.js';

interface ResourcesClientContext {
  mode: 'management' | 'delivery';
  projectBasePath: string;
  requestFromBase: <T>(basePath: string, path: string, init?: RequestInit) => Promise<T>;
}

function assertManagementMode(mode: ResourcesClientContext['mode']) {
  if (mode !== 'management') {
    throw new OriCmsClientError('Resources are only available in management mode', 'INVALID_MODE', 400);
  }
}

export function createResourcesClient(context: ResourcesClientContext) {
  return {
    async list(): Promise<ResourceCollectionDetail[]> {
      assertManagementMode(context.mode);
      const data = await context.requestFromBase<{ resources: ResourceCollectionDetail[] }>(context.projectBasePath, '/resources');
      return data.resources;
    },

    async get(resourceCollectionId: string): Promise<ResourceCollectionDetail> {
      assertManagementMode(context.mode);
      const data = await context.requestFromBase<{ resource: ResourceCollectionDetail }>(
        context.projectBasePath,
        `/resources/${encodeURIComponent(resourceCollectionId)}`,
      );
      return data.resource;
    },

    async listRecords(
      resourceCollectionId: string,
      options?: { page?: number; limit?: number },
    ): Promise<{ records: ResourceRecordSummary[]; pagination: { page: number; limit: number; total: number; pageCount: number } }> {
      assertManagementMode(context.mode);

      const qs = new URLSearchParams();
      if (options?.page) qs.append('page', String(options.page));
      if (options?.limit) qs.append('limit', String(options.limit));
      return context.requestFromBase<{
        records: ResourceRecordSummary[];
        pagination: { page: number; limit: number; total: number; pageCount: number };
      }>(
        context.projectBasePath,
        `/resources/${encodeURIComponent(resourceCollectionId)}/records?${qs.toString()}`,
      );
    },

    async getRecord(resourceCollectionId: string, recordId: string): Promise<ResourceRecordDetail> {
      assertManagementMode(context.mode);
      const data = await context.requestFromBase<{ record: ResourceRecordDetail }>(
        context.projectBasePath,
        `/resources/${encodeURIComponent(resourceCollectionId)}/records/${encodeURIComponent(recordId)}`,
      );
      return data.record;
    },

    async getSchema(resourceCollectionId: string): Promise<ResourceSchemaDefinition> {
      assertManagementMode(context.mode);
      const data = await context.requestFromBase<{ schema: ResourceSchemaDefinition }>(
        context.projectBasePath,
        `/resources/${encodeURIComponent(resourceCollectionId)}/schema`,
      );
      return data.schema;
    },
  };
}
