import type { CollectionConfig, CollectionEntry, CollectionQuery, CollectionQueryResult, ContentType } from '@ori/shared';
import type { BranchCollectionIndex } from './collection-index';
import {
  applyCollectionFilters,
  applyCollectionSort,
  computeCollectionEntryRevision,
  paginateCollectionEntries,
} from './service-support';
import {
  loadIndexedCollectionEntries,
  loadIndexedCollectionEntriesById,
  populateCollectionRelationsForEntries,
  searchCollectionEntries,
} from './collection-service-reads';
import { loadBranchCollectionEntries, loadBranchCollectionEntriesById } from './collection-repository';

export async function loadCollectionEntriesForService(args: {
  branch: string;
  config: CollectionConfig;
  getResolvedPaths: (relativePath: string) => Promise<{ absolute: string; repoRelative: string }>;
  index: BranchCollectionIndex;
  projectId: string;
}) {
  return loadBranchCollectionEntries({
    index: args.index,
    projectId: args.projectId,
    branch: args.branch,
    config: args.config,
    getResolvedPaths: args.getResolvedPaths,
    loadIndexedCollectionEntries,
  });
}

export async function loadCollectionEntriesByIdForService(args: {
  branch: string;
  config: CollectionConfig;
  getResolvedPaths: (relativePath: string) => Promise<{ absolute: string; repoRelative: string }>;
  index: BranchCollectionIndex;
  projectId: string;
}) {
  return loadBranchCollectionEntriesById({
    index: args.index,
    projectId: args.projectId,
    branch: args.branch,
    config: args.config,
    getResolvedPaths: args.getResolvedPaths,
    loadIndexedCollectionEntriesById,
  });
}

export async function findManyCollectionEntries(args: {
  branch: string;
  collectionId: string;
  getCollectionConfig: (collectionId: string) => Promise<CollectionConfig | null>;
  getContentType: (typeName: string) => Promise<ContentType | null>;
  getCurrentRevision: () => Promise<string>;
  getEntries: (config: CollectionConfig) => Promise<CollectionEntry[]>;
  listCollections: () => Promise<CollectionConfig[]>;
  projectId: string;
  populateRelations: (entries: CollectionEntry[], populate: string | string[]) => Promise<void>;
  query?: CollectionQuery;
}): Promise<CollectionQueryResult> {
  const query = args.query || {};
  const config = await args.getCollectionConfig(args.collectionId);
  if (!config) {
    throw new Error(`Collection '${args.collectionId}' not found`);
  }

  const contentType = await args.getContentType(config.contentType);
  if (!contentType) {
    throw new Error(`Content type '${config.contentType}' for collection '${args.collectionId}' not found`);
  }

  const entries = await args.getEntries(config);
  let filtered = applyCollectionFilters(entries, query.filter);

  if (query.search) {
    filtered = await searchCollectionEntries({
      entries: filtered,
      search: query.search,
      contentType,
      projectId: args.projectId,
      branch: args.branch,
      getCurrentRevision: args.getCurrentRevision,
      listCollections: args.listCollections,
      getContentType: args.getContentType,
      getEntries: args.getEntries,
    });
  }

  filtered = applyCollectionSort(filtered, query.sort);
  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);
  const paginatedResult = paginateCollectionEntries(filtered, page, limit);

  if (query.populate) {
    await args.populateRelations(paginatedResult.data, query.populate);
  }

  return {
    data: paginatedResult.data,
    meta: paginatedResult.meta,
  };
}

export async function findCollectionEntry(args: {
  collectionId: string;
  getCollectionConfig: (collectionId: string) => Promise<CollectionConfig | null>;
  getEntriesById: (config: CollectionConfig) => Promise<Map<string, CollectionEntry>>;
  id: string;
  populate?: string | string[];
  populateRelations: (entries: CollectionEntry[], populate: string | string[]) => Promise<void>;
}) {
  const config = await args.getCollectionConfig(args.collectionId);
  if (!config) return null;

  const entriesById = await args.getEntriesById(config);
  const cached = entriesById.get(args.id);
  if (!cached) {
    return null;
  }

  const entry: CollectionEntry = { ...cached };
  if (args.populate) {
    await args.populateRelations([entry], args.populate);
  }

  return entry;
}

export async function findCollectionEntryWithRevision(args: {
  collectionId: string;
  findOne: (collectionId: string, id: string, populate?: string | string[]) => Promise<CollectionEntry | null>;
  id: string;
  populate?: string | string[];
}) {
  const entry = await args.findOne(args.collectionId, args.id, args.populate);
  if (!entry) {
    return null;
  }

  return {
    entry,
    revision: computeCollectionEntryRevision(entry),
  };
}

export async function populateCollectionRelations(args: {
  entries: CollectionEntry[];
  findOne: (collectionId: string, id: string) => Promise<CollectionEntry | null>;
  findManyById?: (collectionId: string, ids: string[]) => Promise<CollectionEntry[]>;
  getContentType: (typeName: string) => Promise<ContentType | null>;
  populate: string | string[];
}) {
  await populateCollectionRelationsForEntries({
    entries: args.entries,
    populate: args.populate,
    getContentType: args.getContentType,
    findOne: args.findOne,
    findManyById: args.findManyById,
  });
}
