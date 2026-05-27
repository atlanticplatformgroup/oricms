import * as fs from 'fs/promises';
import type { Stats } from 'fs';
import * as path from 'path';
import simpleGit, { type SimpleGit } from 'simple-git';
import { normalizeAssetMetadata } from '@ori/shared';
import type { AssetMetadata } from '@ori/shared';
import { logger } from '../middleware/logger';
import type { Asset, CommitOptions } from './types';

const ASSET_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

function formatCommitAuthor(commitOptions: CommitOptions): string {
  return `${commitOptions.author.name} <${commitOptions.author.email}>`;
}

async function commitAndPush(
  workspacePath: string,
  commitOptions: CommitOptions,
  applyChanges: (git: SimpleGit) => Promise<void>,
): Promise<void> {
  const git = simpleGit(workspacePath);
  await applyChanges(git);
  await git.commit(commitOptions.message, {
    '--author': formatCommitAuthor(commitOptions),
  });
  const remotes = await git.getRemotes();
  if (remotes.length > 0) {
    await git.push();
  }
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function decodeAssetContent(projectId: string, folder: string, filename: string, content: string): Buffer {
  const parts = content.split(',');
  if (parts.length < 2) {
    logger.error({
      msg: 'Invalid asset content format',
      projectId,
      folder,
      filename,
      preview: content.substring(0, 50),
    });
    throw new Error('Invalid content format: expected data URL');
  }

  return Buffer.from(parts[1], 'base64');
}

export function getAssetType(filename: string): Asset['type'] {
  const ext = path.extname(filename).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'].includes(ext)) {
    return 'image';
  }
  if (ext === '.pdf') {
    return 'document';
  }
  return 'file';
}

export function getAssetMimeType(assetPath: string): string {
  return ASSET_MIME_TYPES[path.extname(assetPath).toLowerCase()] || 'application/octet-stream';
}

export async function readAssetMetadata(
  workspacePath: string,
  assetPath: string,
): Promise<AssetMetadata | undefined> {
  const metadataPath = path.join(workspacePath, `${assetPath}.json`);
  try {
    const content = await fs.readFile(metadataPath, 'utf-8');
    return normalizeAssetMetadata(JSON.parse(content) as AssetMetadata);
  } catch {
    return undefined;
  }
}

export async function updateAssetMetadataInGit(options: {
  workspacePath: string;
  assetPath: string;
  metadata: AssetMetadata;
  commitOptions: CommitOptions;
}): Promise<AssetMetadata> {
  const normalizedMetadata = normalizeAssetMetadata(options.metadata);
  await fs.writeFile(
    path.join(options.workspacePath, `${options.assetPath}.json`),
    JSON.stringify(normalizedMetadata, null, 2) + '\n',
  );

  await commitAndPush(options.workspacePath, options.commitOptions, async (git) => {
    await git.add(`${options.assetPath}.json`);
  });

  return normalizedMetadata;
}

export async function uploadAssetFiles(options: {
  projectId: string;
  workspacePath: string;
  assetDir: string;
  folder: string;
  filename: string;
  content: string;
  metadata?: AssetMetadata;
  commitOptions: CommitOptions;
}): Promise<{
  relativePath: string;
  normalizedMetadata?: AssetMetadata;
  stat: Stats;
}> {
  const assetPath = path.join(options.assetDir, options.filename);
  const relativePath = `assets/${options.folder}/${options.filename}`;
  const relativeMetadataPath = `${relativePath}.json`;
  const buffer = decodeAssetContent(options.projectId, options.folder, options.filename, options.content);

  try {
    await fs.writeFile(assetPath, buffer);
  } catch (error) {
    logger.error({ msg: 'Failed to write asset file', projectId: options.projectId, assetPath, error });
    throw error;
  }

  const normalizedMetadata = options.metadata ? normalizeAssetMetadata(options.metadata) : undefined;
  if (normalizedMetadata && Object.keys(normalizedMetadata).length > 0) {
    await fs.writeFile(
      path.join(options.workspacePath, relativeMetadataPath),
      JSON.stringify(normalizedMetadata, null, 2) + '\n',
    );
  }

  try {
    await commitAndPush(options.workspacePath, options.commitOptions, async (git) => {
      await git.add(relativePath);
      if (normalizedMetadata && Object.keys(normalizedMetadata).length > 0) {
        await git.add(relativeMetadataPath);
      }
    });
  } catch (error) {
    logger.error({ msg: 'Asset git operation failed', projectId: options.projectId, relativePath, error });
    throw error;
  }

  return {
    relativePath,
    normalizedMetadata,
    stat: await fs.stat(assetPath),
  };
}

export async function deleteAssetFiles(options: {
  workspacePath: string;
  assetPath: string;
  commitOptions: CommitOptions;
}): Promise<void> {
  const fullPath = path.join(options.workspacePath, options.assetPath);
  const metadataPath = path.join(options.workspacePath, `${options.assetPath}.json`);

  await fs.unlink(fullPath);
  await fs.rm(metadataPath, { force: true });

  await commitAndPush(options.workspacePath, options.commitOptions, async (git) => {
    await git.raw(['rm', '--ignore-unmatch', options.assetPath, `${options.assetPath}.json`]);
  });
}

export async function readAssetContentDataUrl(
  workspacePath: string,
  assetPath: string,
): Promise<string | null> {
  try {
    const buffer = await fs.readFile(path.join(workspacePath, assetPath));
    return `data:${getAssetMimeType(assetPath)};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function renameAssetFiles(options: {
  workspacePath: string;
  oldPath: string;
  newPath: string;
  commitOptions: CommitOptions;
}): Promise<void> {
  const nextAssetPath = path.join(options.workspacePath, options.newPath);
  const oldMetadataPath = `${options.oldPath}.json`;
  const nextMetadataPath = `${options.newPath}.json`;
  const metadataExists = await fileExists(path.join(options.workspacePath, oldMetadataPath));

  await fs.mkdir(path.dirname(nextAssetPath), { recursive: true });

  await commitAndPush(options.workspacePath, options.commitOptions, async (git) => {
    await git.mv(options.oldPath, options.newPath);
    if (metadataExists) {
      await git.mv(oldMetadataPath, nextMetadataPath);
    }
  });
}
