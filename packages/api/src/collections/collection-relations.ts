import type { CollectionConfig, CollectionEntry, ContentType, SchemaField } from '@ori/shared';
import { BrowseDisplayResolver } from './browse-display-resolver';

export async function buildBrowseRelationLabelsByField(options: {
  projectId: string;
  branch: string;
  fields: SchemaField[];
  getCurrentRevision: () => Promise<string>;
  listCollections: () => Promise<CollectionConfig[]>;
  getContentType: (typeName: string) => Promise<ContentType | null>;
  getEntries: (config: CollectionConfig) => Promise<CollectionEntry[]>;
}): Promise<Record<string, Record<string, string>>> {
  const resolver = new BrowseDisplayResolver({
    cacheNamespace: `${options.projectId}:${options.branch || 'main'}`,
    getCurrentRevision: options.getCurrentRevision,
    listCollections: options.listCollections,
    getContentType: options.getContentType,
    getEntries: options.getEntries,
  });
  return resolver.resolveRelationLabels(options.fields);
}

export async function populateCollectionRelations(options: {
  entries: CollectionEntry[];
  populate: string | string[];
  getContentType: (typeName: string) => Promise<ContentType | null>;
  findOne: (collectionId: string, id: string) => Promise<CollectionEntry | null>;
}): Promise<void> {
  const fieldsToPopulate = Array.isArray(options.populate) ? options.populate : [options.populate];

  for (const entry of options.entries) {
    for (const fieldName of fieldsToPopulate) {
      const relationId = entry[fieldName];
      if (!relationId || typeof relationId !== 'string') {
        continue;
      }

      const contentType = await options.getContentType(entry.$type);
      if (!contentType) {
        continue;
      }

      const field = contentType.fields.find((candidate) => candidate.key === fieldName);
      if (!field || field.type !== 'relation' || !field.relation) {
        continue;
      }

      const relatedEntry = await options.findOne(field.relation.target, relationId);
      if (relatedEntry) {
        entry[fieldName] = relatedEntry;
      }
    }
  }
}
