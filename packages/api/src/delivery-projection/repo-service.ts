import type { CollectionEntry, ContentType } from '@ori/shared';
import { CollectionService, type CollectionServiceOptions } from '../collections/service';

export async function createProjectionRepoService(
  options: CollectionServiceOptions,
): Promise<CollectionService> {
  const service = new CollectionService(options);
  await service.init();
  return service;
}

export async function getProjectionCollectionContentType(
  repoService: CollectionService,
  collectionId: string,
): Promise<ContentType> {
  const config = await repoService.getCollectionConfig(collectionId);
  if (!config) {
    throw new Error(`Collection '${collectionId}' not found`);
  }

  const contentType = await repoService.getContentType(config.contentType);
  if (!contentType) {
    throw new Error(`Content type '${config.contentType}' for collection '${collectionId}' not found`);
  }

  return contentType;
}

export async function loadAllProjectionEntries(
  repoService: CollectionService,
  collectionId: string,
): Promise<CollectionEntry[]> {
  const entries: CollectionEntry[] = [];
  let page = 1;
  let pageCount = 1;

  do {
    const batch = await repoService.findMany(collectionId, {
      page,
      limit: 100,
    });

    entries.push(...batch.data);
    pageCount = batch.meta.pagination.pageCount;
    page += 1;
  } while (page <= pageCount);

  return entries;
}
