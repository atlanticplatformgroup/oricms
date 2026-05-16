import type { CollectionConfig, ContentType } from '@ori/shared';
import type { GetCollectionConfigFn } from './collection-repository-types';

export async function requireCollectionWithContentType(options: {
  collectionId: string;
  getCollectionConfig: GetCollectionConfigFn;
  getContentType: (typeName: string) => Promise<ContentType | null>;
}): Promise<{ config: CollectionConfig; contentType: ContentType }> {
  const config = await options.getCollectionConfig(options.collectionId);
  if (!config) {
    throw new Error(`Collection '${options.collectionId}' not found`);
  }

  const contentType = await options.getContentType(config.contentType);
  if (!contentType) {
    throw new Error(`Content type '${config.contentType}' not found`);
  }

  return { config, contentType };
}
