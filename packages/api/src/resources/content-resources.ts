import path from 'path';
import type {
  CollectionConfig,
  CollectionEntry,
  ProjectRole,
  ResourceCollectionDetail,
  ResourceRecordDetail,
  ResourceRecordSummary,
  ResourceSchemaDefinition,
} from '@ori/shared';
import { CollectionService } from '../collections/service';
import {
  createResourceCollectionDetail,
  getContentCollectionIdFromResource,
  getContentResourceCollectionId,
} from './system-resources';

export function deriveCollectionEntryLabel(entry: CollectionEntry): string {
  const candidates = [
    entry.title,
    entry.name,
    entry.label,
    entry.slug,
    entry.$id,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return String(entry.$id);
}

export function toContentRecordSummary(
  collection: CollectionConfig,
  entry: CollectionEntry,
): ResourceRecordSummary {
  const entryId = typeof entry.$id === 'string' ? entry.$id : '';
  return {
    id: entryId,
    label: deriveCollectionEntryLabel(entry),
    status: entry.$status,
    createdAt: entry.$createdAt,
    updatedAt: entry.$updatedAt,
    path: path.posix.join(collection.path, `${entryId}.json`),
  };
}

export function toContentRecordDetail(
  collection: CollectionConfig,
  entry: CollectionEntry,
  revision?: string,
): ResourceRecordDetail {
  return {
    ...toContentRecordSummary(collection, entry),
    data: entry,
    meta: revision ? { revision } : undefined,
  };
}

export async function listContentResourceCollections(
  collectionService: CollectionService,
  role: ProjectRole,
): Promise<ResourceCollectionDetail[]> {
  const collections = await collectionService.listCollections();

  return Promise.all(
    collections.map(async (collection) => {
      const result = await collectionService.findMany(collection.id, { page: 1, limit: 1 });
      return createResourceCollectionDetail(
        role,
        getContentResourceCollectionId(collection.id),
        'content',
        'user',
        collection.label,
        {
          description: collection.description,
          schemaId: collection.contentType,
          viewId: 'content.entry-editor',
          recordCount: result.meta.pagination.total,
          path: collection.path,
          source: 'git',
          view: {
            id: 'content.entry-editor',
            kind: 'form',
            editor: 'content',
          },
        },
      );
    }),
  );
}

export async function getContentResourceSchema(
  collectionService: CollectionService,
  resourceCollectionId: string,
): Promise<ResourceSchemaDefinition | null> {
  const contentCollectionId = getContentCollectionIdFromResource(resourceCollectionId);
  if (!contentCollectionId) {
    return null;
  }

  const collection = await collectionService.getCollectionConfig(contentCollectionId);
  if (!collection) {
    return null;
  }

  const contentType = await collectionService.getContentType(collection.contentType);
  if (!contentType) {
    return null;
  }

  return {
    id: contentType.$id,
    label: contentType.label,
    kind: 'content-type',
    document: contentType as unknown as Record<string, unknown>,
  };
}

export async function listContentRecords(
  collectionService: CollectionService,
  resourceCollectionId: string,
  options: { page?: number; limit?: number } = {},
): Promise<{ records: ResourceRecordSummary[]; total: number } | null> {
  const contentCollectionId = getContentCollectionIdFromResource(resourceCollectionId);
  if (!contentCollectionId) {
    return null;
  }

  const collection = await collectionService.getCollectionConfig(contentCollectionId);
  if (!collection) {
    throw new Error('RESOURCE_NOT_FOUND');
  }

  const result = await collectionService.findMany(contentCollectionId, {
    page: options.page,
    limit: options.limit,
  });

  return {
    records: result.data.map((entry) => toContentRecordSummary(collection, entry)),
    total: result.meta.pagination.total,
  };
}

export async function getContentRecord(
  collectionService: CollectionService,
  resourceCollectionId: string,
  recordId: string,
): Promise<ResourceRecordDetail | null> {
  const contentCollectionId = getContentCollectionIdFromResource(resourceCollectionId);
  if (!contentCollectionId) {
    return null;
  }

  const collection = await collectionService.getCollectionConfig(contentCollectionId);
  if (!collection) {
    return null;
  }

  const result = await collectionService.findOneWithRevision(contentCollectionId, recordId);
  if (!result) {
    return null;
  }

  return toContentRecordDetail(collection, result.entry, result.revision);
}
