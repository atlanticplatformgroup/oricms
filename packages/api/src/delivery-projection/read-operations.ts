import type {
  CollectionEntry,
  CollectionQuery,
  CollectionQueryResult,
  ContentType,
  SchemaField,
} from '@ori/shared';
import { prisma } from '../lib/prisma';
import { CollectionService } from '../collections/service';
import { BrowseDisplayResolver } from '../collections/browse-display-resolver';
import { getCollectionBrowseSearchFields, matchesCollectionBrowseSearch } from '../collections/search';
import {
  applyProjectedEntryFilters,
  applyProjectedEntrySort,
  mapProjectionRowsToEntries,
  paginateProjectedEntries,
} from './service-support';
import { findProjectionRow, listProjectionRows } from './store';

interface ProjectionReadContext {
  projectId: string;
  branch: string;
  getRecord: (collectionId: string, entryId: string) => Promise<CollectionEntry | null>;
}

export async function listProjectedRecords(
  context: ProjectionReadContext & {
    collectionId: string;
    query?: CollectionQuery;
    contentType: ContentType;
    repoService: CollectionService;
  },
): Promise<CollectionQueryResult> {
  const query = context.query ?? {};
  const rows = await listProjectionRows(context.projectId, context.branch, context.collectionId);
  let entries = mapProjectionRowsToEntries(rows);
  entries = applyProjectedEntryFilters(entries, query.filter);

  if (query.search) {
    entries = await applyProjectionSearch(entries, query.search, context.contentType, context);
  }

  const total = entries.length;
  entries = applyProjectedEntrySort(entries, query.sort);

  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);
  const paginatedResult = paginateProjectedEntries(entries, page, limit);
  const paginated = paginatedResult.data;

  if (query.populate) {
    await populateProjectionRelations(paginated, query.populate, context);
  }

  return {
    data: paginated,
    meta: {
      pagination: {
        ...paginatedResult.meta.pagination,
        total,
      },
    },
  };
}

export async function getProjectedRecord(
  context: ProjectionReadContext & {
    collectionId: string;
    entryId: string;
    populate?: string | string[];
    repoService?: CollectionService;
  },
): Promise<CollectionEntry | null> {
  const row = await findProjectionRow(
    context.projectId,
    context.branch,
    context.collectionId,
    context.entryId,
  );
  if (!row) {
    return null;
  }

  const entry = { ...(row.data as CollectionEntry) };
  if (context.populate && context.repoService) {
    await populateProjectionRelations([entry], context.populate, {
      ...context,
      repoService: context.repoService,
    });
  }

  return entry;
}

async function applyProjectionSearch(
  entries: CollectionEntry[],
  search: string,
  contentType: ContentType,
  context: ProjectionReadContext & { repoService: CollectionService },
): Promise<CollectionEntry[]> {
  const browseFields = getCollectionBrowseSearchFields(contentType);
  const relationLabelsByField = await buildBrowseRelationLabelsByField(browseFields, context);
  return entries.filter((entry) => matchesCollectionBrowseSearch(entry, search, contentType, relationLabelsByField));
}

async function buildBrowseRelationLabelsByField(
  fields: SchemaField[],
  context: ProjectionReadContext & { repoService: CollectionService },
): Promise<Record<string, Record<string, string>>> {
  const resolver = new BrowseDisplayResolver({
    cacheNamespace: `${context.projectId}:${context.branch}:delivery-projection`,
    getCurrentRevision: async () => {
      const state = await prisma.deliveryProjectionState.findUnique({
        where: {
          projectId_branch: {
            projectId: context.projectId,
            branch: context.branch,
          },
        },
      });
      return state?.revision || 'unprojected';
    },
    listCollections: () => context.repoService.listCollections(),
    getContentType: (typeName) => context.repoService.getContentType(typeName),
    getEntries: async (config) => {
      const rows = await listProjectionRows(context.projectId, context.branch, config.id);
      return mapProjectionRowsToEntries(rows);
    },
  });
  return resolver.resolveRelationLabels(fields);
}

async function populateProjectionRelations(
  entries: CollectionEntry[],
  populate: string | string[],
  context: ProjectionReadContext & { repoService: CollectionService },
): Promise<void> {
  const fieldsToPopulate = Array.isArray(populate) ? populate : [populate];
  const collections = await context.repoService.listCollections();

  for (const entry of entries) {
    for (const fieldName of fieldsToPopulate) {
      const relationId = entry[fieldName];
      if (!relationId || typeof relationId !== 'string') continue;

      const contentType = await context.repoService.getContentType(entry.$type);
      if (!contentType) continue;

      const field = contentType.fields.find((candidate) => candidate.key === fieldName);
      if (!field || field.type !== 'relation' || !field.relation) continue;

      const targetCollection =
        collections.find((collection) => collection.id === field.relation?.target)
        || collections.find((collection) => collection.contentType === field.relation?.target);
      if (!targetCollection) continue;

      const relatedEntry = await context.getRecord(targetCollection.id, relationId);
      if (relatedEntry) {
        entry[fieldName] = relatedEntry;
      }
    }
  }
}
