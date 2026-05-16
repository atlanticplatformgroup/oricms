import type {
  AgentAccessConfig,
  CollectionEntry,
  CollectionQuery,
  ContentType,
} from '@ori/shared';
import type { CollectionService } from '../collections/service';
import { filterEntry, isCollectionAllowed } from './filter';

type GetCollectionService = (branch: string) => Promise<CollectionService>;

export async function loadContentTypesFromCollections(
  branch: string,
  getCollectionService: GetCollectionService,
): Promise<ContentType[]> {
  const service = await getCollectionService(branch);
  const collections = await service.listCollections();
  const types: ContentType[] = [];

  for (const config of collections) {
    const type = await service.getContentType(config.contentType);
    if (type) {
      types.push(type);
    }
  }

  return types;
}

export async function loadContentTypeFromCollections(
  contentTypeId: string,
  branch: string,
  getCollectionService: GetCollectionService,
): Promise<{ filePath: string; contentType: ContentType } | null> {
  const service = await getCollectionService(branch);
  const type = await service.getContentType(contentTypeId);
  return type ? { filePath: `schemas/types/${contentTypeId}.json`, contentType: type } : null;
}

export async function loadCollectionEntriesFromCollections(input: {
  branch: string;
  collectionId: string;
  query: CollectionQuery;
  contentType: ContentType;
  config: AgentAccessConfig;
  getCollectionService: GetCollectionService;
  logFileAccess: (
    filePath: string,
    branch: string,
    contentRead: boolean,
    wasRedacted: boolean,
    piiPatternsFound: string[],
  ) => Promise<void>;
}) {
  const service = await input.getCollectionService(input.branch);
  const result = await service.findMany(input.collectionId, input.query);
  const entries: CollectionEntry[] = [];
  const fieldsHidden: string[] = [];
  const piiPatterns = new Set<string>();
  let anyRedacted = false;

  for (const entry of result.data) {
    const filterResult = filterEntry(entry, input.contentType, { config: input.config });

    entries.push(filterResult.data);
    if (filterResult.wasRedacted) anyRedacted = true;
    filterResult.piiPatternsFound.forEach((pattern) => piiPatterns.add(pattern));
    filterResult.fieldsHidden.forEach((field) => {
      if (!fieldsHidden.includes(field)) fieldsHidden.push(field);
    });

    await input.logFileAccess(
      `collections/${input.collectionId}/${entry.$id}.json`,
      input.branch,
      true,
      filterResult.wasRedacted,
      filterResult.piiPatternsFound,
    );
  }

  return {
    entries,
    wasRedacted: anyRedacted,
    piiPatternsFound: Array.from(piiPatterns),
    fieldsHidden,
  };
}

export async function loadEntryFromCollections(input: {
  branch: string;
  collectionId: string;
  entryId: string;
  contentType: ContentType;
  config: AgentAccessConfig;
  getCollectionService: GetCollectionService;
}) {
  const service = await input.getCollectionService(input.branch);
  const entry = await service.findOne(input.collectionId, input.entryId);
  if (!entry) {
    return null;
  }

  const filterResult = filterEntry(entry, input.contentType, { config: input.config });

  return {
    entry: filterResult.data,
    filePath: `collections/${input.collectionId}/${input.entryId}.json`,
    wasRedacted: filterResult.wasRedacted,
    piiPatternsFound: filterResult.piiPatternsFound,
    fieldsHidden: filterResult.fieldsHidden,
  };
}

export async function loadRepositoryStructureFromCollections(input: {
  branch: string;
  config: AgentAccessConfig;
  getCollectionService: GetCollectionService;
}) {
  const service = await input.getCollectionService(input.branch);
  const collectionsConfig = await service.listCollections();
  const schemas = collectionsConfig.map((collection) => collection.contentType);
  const collections: Array<{ name: string; allowed: boolean; count?: number }> = [];

  for (const config of collectionsConfig) {
    const allowed = isCollectionAllowed(config.id, input.config);
    const result = allowed
      ? await service.findMany(config.id, { limit: 1 })
      : { meta: { pagination: { total: 0 } } };

    collections.push({
      name: config.id,
      allowed,
      count: result.meta.pagination.total,
    });
  }

  return { schemas, collections };
}
