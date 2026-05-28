import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'fast-glob';
import { getPreferredFieldKey, normalizeAssetReference, resolveFieldCapability } from '@ori/shared';
import type {
  AssetMetadata,
  AssetUsageReference,
  AssetUsageSummary,
  CollectionConfig,
  ContentType,
  SchemaField,
} from '@ori/shared';

export interface AssetUsageIndex {
  counts: Map<string, number>;
  references: Map<string, AssetUsageReference[]>;
}

type AssetUsageCandidate = {
  path: string;
  metadata?: AssetMetadata;
};

function resolveEntryDisplayLabel(entry: Record<string, unknown>, contentType: ContentType | null): string {
  const entryId = String(entry.$id || '');
  const primaryKey = contentType?.display?.primary || getPreferredFieldKey(contentType, ['title', 'name', 'label']) || '$id';
  const primaryField = contentType?.fields.find((candidate) => candidate.key === primaryKey) as SchemaField | undefined;

  return (
    resolveFieldCapability({
      field: primaryField,
      fieldType: primaryField?.type || '$id',
      value: primaryKey === '$id' ? entryId : entry[primaryKey],
    }).displayText || entryId
  );
}

function normalizeAssetUsageCandidate(value: string): string {
  return value.trim().replace(/^\/+/, '');
}

function getAssetPathAliases(assetPath: string): string[] {
  const normalized = normalizeAssetUsageCandidate(assetPath);
  const aliases = new Set<string>([normalized, `/${normalized}`]);

  if (normalized.startsWith('assets/images/')) {
    const basename = path.basename(normalized);
    aliases.add(`media/${basename}`);
    aliases.add(`/media/${basename}`);
  }

  if (normalized.startsWith('assets/documents/')) {
    const basename = path.basename(normalized);
    aliases.add(`docs/${basename}`);
    aliases.add(`/docs/${basename}`);
  }

  return Array.from(aliases);
}

function isAssetUsageCandidate(value: string): boolean {
  const normalized = normalizeAssetUsageCandidate(value);
  return (
    normalized.startsWith('assets/') ||
    normalized.startsWith('media/') ||
    normalized.startsWith('docs/')
  );
}

function collectEntryAssetCandidates(value: unknown, results: Set<string>) {
  const assetReference = normalizeAssetReference(value);
  if (assetReference) {
    if (assetReference.scope === 'project' && isAssetUsageCandidate(assetReference.path)) {
      results.add(normalizeAssetUsageCandidate(assetReference.path));
    }
    return;
  }

  if (typeof value === 'string') {
    if (isAssetUsageCandidate(value)) {
      results.add(normalizeAssetUsageCandidate(value));
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectEntryAssetCandidates(entry, results));
    return;
  }

  if (value && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      if (key.startsWith('$')) return;
      collectEntryAssetCandidates(entry, results);
    });
  }
}

async function getContentTypeSchema(workspacePath: string, contentTypeName: string): Promise<ContentType | null> {
  const schemaPath = path.join(workspacePath, 'schemas', 'types', `${contentTypeName}.json`);
  try {
    const content = await fs.readFile(schemaPath, 'utf-8');
    return JSON.parse(content) as ContentType;
  } catch {
    return null;
  }
}

export function resolveAssetUsageSummary(count: number): AssetUsageSummary {
  return {
    count,
    status: count > 0 ? 'used' : 'unused',
  };
}

export async function getAssetUsageIndex(options: {
  projectId: string;
  workspacePath: string;
  assets: AssetUsageCandidate[];
  projectSettings: Record<string, unknown>;
}): Promise<AssetUsageIndex> {
  if (!options.assets.length) {
    return {
      counts: new Map(),
      references: new Map(),
    };
  }

  const contentRoot = typeof options.projectSettings.contentRoot === 'string' ? options.projectSettings.contentRoot : '';
  const collectionsPath = path.join(options.workspacePath, 'oricms', 'collections.json');

  let collections: CollectionConfig[] = [];
  try {
    const content = await fs.readFile(collectionsPath, 'utf-8');
    collections = JSON.parse(content) as CollectionConfig[];
  } catch {
    return { counts: new Map(), references: new Map() };
  }

  if (!Array.isArray(collections) || collections.length === 0) {
    return { counts: new Map(), references: new Map() };
  }

  const aliasLookup = new Map<string, string>();
  for (const asset of options.assets) {
    for (const alias of getAssetPathAliases(asset.path)) {
      aliasLookup.set(alias, asset.path);
    }
  }

  const usageCounts = new Map<string, number>();
  const usageReferences = new Map<string, AssetUsageReference[]>();
  const contentTypeCache = new Map<string, ContentType | null>();

  for (const collection of collections) {
    const entriesDir = path.join(options.workspacePath, contentRoot, collection.path);
    let files: string[] = [];
    try {
      files = await glob('*.json', { cwd: entriesDir, absolute: true, onlyFiles: true });
    } catch {
      continue;
    }

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const entry = JSON.parse(content) as Record<string, unknown>;
        const referencedAssets = new Set<string>();
        collectEntryAssetCandidates(entry, referencedAssets);
        const entryId = String(entry.$id || path.basename(file, '.json'));

        if (!contentTypeCache.has(collection.contentType)) {
          contentTypeCache.set(
            collection.contentType,
            await getContentTypeSchema(options.workspacePath, collection.contentType),
          );
        }

        const contentType = contentTypeCache.get(collection.contentType) || null;
        const entryLabel = resolveEntryDisplayLabel({ ...entry, $id: entryId }, contentType);
        const entryPath = path.posix.join(contentRoot || '', collection.path, `${entryId}.json`).replace(/^\/+/, '');

        for (const candidate of referencedAssets) {
          const canonical = aliasLookup.get(candidate) || aliasLookup.get(`/${candidate}`);
          if (!canonical) continue;
          usageCounts.set(canonical, (usageCounts.get(canonical) || 0) + 1);
          const references = usageReferences.get(canonical) || [];
          references.push({
            collectionId: collection.id,
            collectionLabel: collection.label,
            entryId,
            entryLabel,
            entryPath,
          });
          usageReferences.set(canonical, references);
        }
      } catch {
        continue;
      }
    }
  }

  return {
    counts: usageCounts,
    references: usageReferences,
  };
}
