import * as fs from 'fs/promises';
import * as path from 'path';
import { normalizeAssetMetadata } from '@ori/shared';
import type { GlobalAsset } from '@ori/shared';
import type { GlobalAssetMetadata } from './global-types';

export function getGlobalAssetType(filename: string): GlobalAsset['type'] {
  const lower = filename.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|svg|webp|avif)$/i.test(lower)) return 'image';
  if (/\.(pdf|doc|docx|txt|rtf)$/i.test(lower)) return 'document';
  return 'file';
}

export function getGlobalAssetUrl(projectId: string, assetId: string): string {
  const encodedId = assetId
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `/api/v1/projects/${encodeURIComponent(projectId)}/global-assets/raw/${encodedId}`;
}

export function getGlobalAssetMetadataPath(workspacePath: string, assetId: string): string {
  return path.join(workspacePath, `${assetId}.json`);
}

export async function readGlobalAssetMetadata(
  workspacePath: string,
  assetId: string,
): Promise<GlobalAssetMetadata | undefined> {
  try {
    const content = await fs.readFile(getGlobalAssetMetadataPath(workspacePath, assetId), 'utf-8');
    return normalizeAssetMetadata(JSON.parse(content) as GlobalAssetMetadata) as GlobalAssetMetadata;
  } catch {
    return undefined;
  }
}

export async function listGlobalAssetIds(workspacePath: string): Promise<string[]> {
  const assetIds: string[] = [];

  const walk = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git') continue;

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(workspacePath, fullPath).split(path.sep).join('/');

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (entry.name.endsWith('.json') || entry.name === 'README.md') continue;
      assetIds.push(relativePath);
    }
  };

  await walk(workspacePath);
  return assetIds.sort();
}

export async function toGlobalAsset(
  projectId: string,
  workspacePath: string,
  assetId: string,
): Promise<GlobalAsset | null> {
  const fullPath = path.join(workspacePath, assetId);

  try {
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) return null;

    const metadata = await readGlobalAssetMetadata(workspacePath, assetId);
    const filename = path.basename(assetId);
    const folder = path.dirname(assetId) === '.' ? '' : path.dirname(assetId);
    const resolvedAssetId = metadata?.assetId || assetId;

    return {
      assetId: resolvedAssetId,
      scope: 'global',
      path: assetId,
      name: filename,
      folder,
      size: stat.size,
      type: getGlobalAssetType(filename),
      url: getGlobalAssetUrl(projectId, resolvedAssetId),
      lastModified: stat.mtime.toISOString(),
      metadata,
    };
  } catch {
    return null;
  }
}
