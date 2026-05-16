import * as fs from 'fs/promises';
import * as path from 'path';
import type { AssetListOptions, AssetListResult, Asset } from './types';
import { getAssetUsageIndex, resolveAssetUsageSummary } from './asset-usage';
import {
  attachAssetUsage,
  buildAssetTagFacets,
  buildAssetUsageFacets,
  filterAssetsBySearch,
  filterAssetsByTag,
  filterAssetsByUsage,
  mergeAssetFolders,
  paginateAssets,
  sortAssets,
} from './asset-listing';
import { getProjectAssetUrl } from './asset-paths';
import { getAssetType, readAssetMetadata } from './asset-file-operations';

export async function listProjectFolderAssets(input: {
  projectId: string;
  workspacePath: string;
  folder?: string;
}): Promise<Asset[]> {
  const folder = input.folder || 'images';
  const assetPath = path.join(input.workspacePath, 'assets', folder);

  try {
    const entries = await fs.readdir(assetPath, { withFileTypes: true });
    const assets = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && !entry.name.endsWith('.json'))
        .map(async (entry) => {
          const filePath = path.join(assetPath, entry.name);
          const relativePath = `assets/${folder}/${entry.name}`;
          const stat = await fs.stat(filePath);
          const metadata = await readAssetMetadata(input.workspacePath, relativePath);

          return {
            path: relativePath,
            name: entry.name,
            folder,
            size: stat.size,
            type: getAssetType(entry.name),
            url: getProjectAssetUrl(input.projectId, relativePath),
            lastModified: stat.mtime.toISOString(),
            metadata,
          } satisfies Asset;
        }),
    );

    return assets.sort((left, right) => (
      new Date(right.lastModified).getTime() - new Date(left.lastModified).getTime()
    ));
  } catch {
    return [];
  }
}

export async function listProjectAssets(input: {
  projectId: string;
  workspacePath: string;
  projectSettings: Record<string, unknown>;
  options: AssetListOptions;
}): Promise<AssetListResult> {
  const folder = input.options.folder || 'images';
  const tag = input.options.tag;
  const usage = input.options.usage || 'all';
  const search = input.options.search?.trim().toLowerCase() || '';
  const sort = input.options.sort || 'newest';
  const limit = typeof input.options.limit === 'number' ? Math.max(1, input.options.limit) : null;
  const offset = Math.max(0, input.options.offset || 0);

  const folders = folder === 'all' ? ['images', 'documents'] : [folder];
  const folderResults = await Promise.all(
    folders.map((entry) => listProjectFolderAssets({
      projectId: input.projectId,
      workspacePath: input.workspacePath,
      folder: entry,
    })),
  );
  const mergedAssets = mergeAssetFolders(folderResults);
  const usageIndex = await getAssetUsageIndex({
    projectId: input.projectId,
    workspacePath: input.workspacePath,
    assets: mergedAssets,
    projectSettings: input.projectSettings,
  });
  const assetsWithUsage = attachAssetUsage(mergedAssets, usageIndex.counts);
  const searchedAssets = filterAssetsBySearch(assetsWithUsage, search);
  const tags = buildAssetTagFacets(searchedAssets);
  const filteredAssets = filterAssetsByTag(searchedAssets, tag);
  const usageFacets = buildAssetUsageFacets(filteredAssets);
  const usageFilteredAssets = filterAssetsByUsage(filteredAssets, usage);
  const sortedAssets = sortAssets(usageFilteredAssets, sort);
  const paginated = paginateAssets(sortedAssets, limit, offset);

  return {
    assets: paginated.assets,
    pagination: paginated.pagination,
    facets: {
      tags,
      usage: usageFacets,
    },
  };
}

export async function getProjectAsset(input: {
  projectId: string;
  workspacePath: string;
  projectSettings: Record<string, unknown>;
  assetPath: string;
}): Promise<Asset | null> {
  const fullPath = path.join(input.workspacePath, input.assetPath);

  try {
    const stat = await fs.stat(fullPath);
    const filename = path.basename(input.assetPath);
    const folder = path.dirname(input.assetPath).replace('assets/', '');
    const metadata = await readAssetMetadata(input.workspacePath, input.assetPath);

    const baseAsset: Asset = {
      path: input.assetPath,
      name: filename,
      folder,
      size: stat.size,
      type: getAssetType(filename),
      url: getProjectAssetUrl(input.projectId, input.assetPath),
      lastModified: stat.mtime.toISOString(),
      metadata,
    };

    const usageIndex = await getAssetUsageIndex({
      projectId: input.projectId,
      workspacePath: input.workspacePath,
      assets: [baseAsset],
      projectSettings: input.projectSettings,
    });

    return {
      ...baseAsset,
      usage: resolveAssetUsageSummary(usageIndex.counts.get(input.assetPath) || 0),
      usageDetail: {
        references: usageIndex.references.get(input.assetPath) || [],
      },
    };
  } catch {
    return null;
  }
}
