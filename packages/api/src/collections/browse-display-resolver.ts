import { getPreferredFieldKey, resolveFieldCapability } from '@ori/shared';
import type { CollectionConfig, CollectionEntry, ContentType, SchemaField } from '@ori/shared';

interface BrowseDisplayResolverOptions {
  cacheNamespace: string;
  getCurrentRevision: () => Promise<string>;
  listCollections: () => Promise<CollectionConfig[]>;
  getContentType: (typeName: string) => Promise<ContentType | null>;
  getEntries: (config: CollectionConfig) => Promise<CollectionEntry[]>;
}

export class BrowseDisplayResolver {
  private static relationLabelCache = new Map<string, Record<string, Record<string, string>>>();
  private readonly cacheNamespace: string;
  private readonly getCurrentRevisionFn: () => Promise<string>;
  private readonly listCollectionsFn: () => Promise<CollectionConfig[]>;
  private readonly getContentTypeFn: (typeName: string) => Promise<ContentType | null>;
  private readonly getEntriesFn: (config: CollectionConfig) => Promise<CollectionEntry[]>;

  constructor(options: BrowseDisplayResolverOptions) {
    this.cacheNamespace = options.cacheNamespace;
    this.getCurrentRevisionFn = options.getCurrentRevision;
    this.listCollectionsFn = options.listCollections;
    this.getContentTypeFn = options.getContentType;
    this.getEntriesFn = options.getEntries;
  }

  async resolveRelationLabels(fields: SchemaField[]): Promise<Record<string, Record<string, string>>> {
    const relationFields = fields.filter((field) => field.type === 'relation' || field.type === 'reference');
    if (!relationFields.length) {
      return {};
    }

    const revision = await this.getCurrentRevisionFn();
    const cacheKey = `${this.cacheNamespace}:${revision}:${relationFields.map((field) => field.key).sort().join('|')}`;
    const cached = BrowseDisplayResolver.relationLabelCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const collections = await this.listCollectionsFn();
    const relationLabelsByField: Record<string, Record<string, string>> = {};

    await Promise.all(
      relationFields.map(async (field) => {
        const targetCollection = this.resolveTargetCollection(field, collections);
        if (!targetCollection) {
          relationLabelsByField[field.key] = {};
          return;
        }

        const targetType = await this.getContentTypeFn(targetCollection.contentType);
        const targetEntries = await this.getEntriesFn(targetCollection);
        const targetPrimaryField = targetType?.display?.primary || getPreferredFieldKey(targetType, ['title', 'name', 'label']) || '$id';
        const targetField = targetType?.fields.find((candidate) => candidate.key === targetPrimaryField);

        relationLabelsByField[field.key] = Object.fromEntries(
          targetEntries.map((entry) => {
            const display = resolveFieldCapability({
              field: targetField,
              fieldType: targetField?.type || '$id',
              value: targetPrimaryField === '$id' ? entry.$id : entry[targetPrimaryField],
            }).displayText || String(entry.$id);
            return [String(entry.$id), display];
          }),
        );
      }),
    );

    BrowseDisplayResolver.relationLabelCache.set(cacheKey, relationLabelsByField);
    return relationLabelsByField;
  }

  private resolveTargetCollection(field: SchemaField, collections: CollectionConfig[]): CollectionConfig | null {
    const targetHint = field.relation?.target || field.options?.referenceCollection;
    if (!targetHint) return null;

    const byId = collections.find((collection) => collection.id === targetHint);
    if (byId) return byId;

    return collections.find((collection) => collection.contentType === targetHint) || null;
  }
}
