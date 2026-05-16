import path from 'path';
import fs from 'fs/promises';
import glob from 'fast-glob';
import type { CollectionConfig, CollectionEntry } from '@ori/shared';
import { logger } from '../middleware/logger';

export interface BranchCollectionIndex {
  revision: string;
  entriesByType: Map<string, CollectionEntry[]>;
  entriesByTypeAndId: Map<string, Map<string, CollectionEntry>>;
  updatedAt: number;
}

export function getCollectionBranchCacheKey(projectId: string, branch: string): string {
  return `${projectId}:${branch || 'main'}`;
}

export function getOrBuildCollectionBranchIndex(
  indexCache: Map<string, BranchCollectionIndex>,
  cacheKey: string,
  revision: string,
): BranchCollectionIndex {
  const existing = indexCache.get(cacheKey);
  if (existing && existing.revision === revision) {
    return existing;
  }

  const next: BranchCollectionIndex = {
    revision,
    entriesByType: new Map(),
    entriesByTypeAndId: new Map(),
    updatedAt: Date.now(),
  };
  indexCache.set(cacheKey, next);
  return next;
}

function cloneCollectionEntries(entries: CollectionEntry[]): CollectionEntry[] {
  return entries.map((entry) => ({ ...entry }));
}

export async function loadCollectionEntries(options: {
  projectId: string;
  branch: string;
  config: CollectionConfig;
  entriesDir: string;
}): Promise<CollectionEntry[]> {
  const entries: CollectionEntry[] = [];

  try {
    await fs.mkdir(options.entriesDir, { recursive: true });

    const files = await glob('*.json', {
      cwd: options.entriesDir,
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const data = JSON.parse(content);

        entries.push({
          ...data,
          $id: data.$id || data.id || path.basename(file, '.json'),
          $type: data.$type || options.config.contentType,
        });
      } catch (error) {
        logger.warn({
          msg: 'Failed to parse collection entry file',
          projectId: options.projectId,
          branch: options.branch,
          file,
          error,
        });
      }
    }
  } catch (error) {
    logger.warn({
      msg: 'Failed to load collection entries',
      projectId: options.projectId,
      branch: options.branch,
      path: options.config.path,
      error,
    });
  }

  return entries;
}

async function ensureIndexedCollectionEntries(
  index: BranchCollectionIndex,
  cacheKey: string,
  loadEntries: () => Promise<CollectionEntry[]>,
): Promise<void> {
  if (index.entriesByType.has(cacheKey)) {
    return;
  }

  const entries = await loadEntries();
  index.entriesByType.set(cacheKey, entries);
  index.entriesByTypeAndId.set(
    cacheKey,
    new Map(entries.map((entry) => [entry.$id, entry])),
  );
  index.updatedAt = Date.now();
}

export async function getIndexedCollectionEntries(
  index: BranchCollectionIndex,
  cacheKey: string,
  loadEntries: () => Promise<CollectionEntry[]>,
): Promise<CollectionEntry[]> {
  await ensureIndexedCollectionEntries(index, cacheKey, loadEntries);
  return cloneCollectionEntries(index.entriesByType.get(cacheKey) || []);
}

export async function getIndexedCollectionEntriesById(
  index: BranchCollectionIndex,
  cacheKey: string,
  loadEntries: () => Promise<CollectionEntry[]>,
): Promise<Map<string, CollectionEntry>> {
  await ensureIndexedCollectionEntries(index, cacheKey, loadEntries);
  return index.entriesByTypeAndId.get(cacheKey) || new Map();
}
