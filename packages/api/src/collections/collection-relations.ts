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
  findManyById?: (collectionId: string, ids: string[]) => Promise<CollectionEntry[]>;
}): Promise<void> {
  const fieldsToPopulate = Array.isArray(options.populate) ? options.populate : [options.populate];

  // Batch 1: collect all unique content types needed
  const typeNames = new Set<string>();
  for (const entry of options.entries) {
    typeNames.add(entry.$type);
  }

  const contentTypes = new Map<string, ContentType | null>();
  await Promise.all(
    Array.from(typeNames).map(async (typeName) => {
      contentTypes.set(typeName, await options.getContentType(typeName));
    }),
  );

  // Batch 2: collect all unique relation targets
  const relationTargets = new Map<string, Set<string>>();
  for (const entry of options.entries) {
    const contentType = contentTypes.get(entry.$type);
    if (!contentType) continue;

    for (const fieldName of fieldsToPopulate) {
      const relationId = entry[fieldName];
      if (!relationId || typeof relationId !== 'string') {
        continue;
      }
      const field = contentType.fields.find((candidate) => candidate.key === fieldName);
      if (!field || field.type !== 'relation' || !field.relation) {
        continue;
      }
      const target = field.relation.target;
      if (!relationTargets.has(target)) {
        relationTargets.set(target, new Set());
      }
      relationTargets.get(target)!.add(relationId);
    }
  }

  // Batch 3: fetch all related entries in parallel (batched findMany when available)
  const relatedEntries = new Map<string, Map<string, CollectionEntry | null>>();
  await Promise.all(
    Array.from(relationTargets.entries()).map(async ([target, ids]) => {
      const entries = new Map<string, CollectionEntry | null>();
      const idList = Array.from(ids);

      if (options.findManyById) {
        const found = await options.findManyById(target, idList);
        for (const item of found) {
          entries.set(item.$id, item);
        }
      } else {
        await Promise.all(
          idList.map(async (id) => {
            entries.set(id, await options.findOne(target, id));
          }),
        );
      }

      relatedEntries.set(target, entries);
    }),
  );

  // Assign resolved relations back to entries
  for (const entry of options.entries) {
    const contentType = contentTypes.get(entry.$type);
    if (!contentType) continue;

    for (const fieldName of fieldsToPopulate) {
      const relationId = entry[fieldName];
      if (!relationId || typeof relationId !== 'string') {
        continue;
      }
      const field = contentType.fields.find((candidate) => candidate.key === fieldName);
      if (!field || field.type !== 'relation' || !field.relation) {
        continue;
      }
      const target = field.relation.target;
      const resolved = relatedEntries.get(target)?.get(relationId);
      if (resolved) {
        entry[fieldName] = resolved;
      }
    }
  }
}
