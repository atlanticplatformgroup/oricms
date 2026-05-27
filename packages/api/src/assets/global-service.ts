import * as fs from 'fs/promises';
import * as path from 'path';
import { normalizeAssetMetadata } from '@ori/shared';
import type { GlobalAsset } from '@ori/shared';
import {
  commitGlobalAssetChanges,
  ensureGlobalAssetRepository,
} from './global-asset-repository';
import {
  getGlobalAssetMetadataPath,
  listGlobalAssetIds,
  readGlobalAssetMetadata,
  toGlobalAsset,
} from './global-asset-support';
import type { CommitOptions, GlobalAssetMetadata } from './global-types';

export type { GlobalAssetMetadata } from './global-types';

export class GlobalAssetService {
  private async ensureRepository(): Promise<string> {
    return ensureGlobalAssetRepository();
  }

  private async toGlobalAsset(projectId: string, assetId: string): Promise<GlobalAsset | null> {
    const workspacePath = await this.ensureRepository();
    return toGlobalAsset(projectId, workspacePath, assetId);
  }

  async listAssets(projectId: string): Promise<{ assets: GlobalAsset[] }> {
    const workspacePath = await this.ensureRepository();
    const assetIds = await listGlobalAssetIds(workspacePath);

    const assets = (await Promise.all(assetIds.map((assetId) => this.toGlobalAsset(projectId, assetId))))
      .filter((asset): asset is GlobalAsset => Boolean(asset))
      .sort((left, right) => new Date(right.lastModified).getTime() - new Date(left.lastModified).getTime());

    return { assets };
  }

  async getAsset(projectId: string, assetId: string): Promise<GlobalAsset | null> {
    const listed = await this.listAssets(projectId);
    return listed.assets.find((asset) => asset.assetId === assetId || asset.path === assetId) ?? null;
  }

  async updateMetadata(
    projectId: string,
    assetId: string,
    metadata: GlobalAssetMetadata,
    commitOptions: CommitOptions,
  ): Promise<GlobalAsset> {
    const workspacePath = await this.ensureRepository();
    const asset = await this.getAsset(projectId, assetId);
    if (!asset) {
      throw new Error('Global asset not found');
    }

    const metadataPath = path.join(workspacePath, `${asset.path}.json`);
    const nextMetadata = normalizeAssetMetadata({
      ...(await readGlobalAssetMetadata(workspacePath, asset.path)),
      ...metadata,
    }) as GlobalAssetMetadata;

    if (Object.keys(nextMetadata).length > 0) {
      await fs.mkdir(path.dirname(metadataPath), { recursive: true });
      await fs.writeFile(metadataPath, JSON.stringify(nextMetadata, null, 2), 'utf-8');
    } else {
      await fs.rm(metadataPath, { force: true });
    }

    await commitGlobalAssetChanges(workspacePath, [`${asset.path}.json`], commitOptions);

    const updated = await this.toGlobalAsset(projectId, asset.path);
    if (!updated) {
      throw new Error('Failed to resolve updated global asset');
    }
    return updated;
  }

  async deleteAsset(
    projectId: string,
    assetId: string,
    commitOptions: CommitOptions,
  ): Promise<void> {
    const workspacePath = await this.ensureRepository();
    const asset = await this.getAsset(projectId, assetId);
    if (!asset) {
      throw new Error('Global asset not found');
    }

    const assetPath = path.join(workspacePath, asset.path);
    const metadataPath = path.join(workspacePath, `${asset.path}.json`);

    await fs.rm(assetPath, { force: true });
    await fs.rm(metadataPath, { force: true });

    await commitGlobalAssetChanges(workspacePath, [asset.path, `${asset.path}.json`], commitOptions);
  }

  async uploadAsset(
    projectId: string,
    folder: string,
    filename: string,
    content: string,
    metadata: GlobalAssetMetadata | undefined,
    commitOptions: CommitOptions,
  ): Promise<GlobalAsset> {
    const workspacePath = await this.ensureRepository();
    const targetDir = path.join(workspacePath, folder);
    await fs.mkdir(targetDir, { recursive: true });

    const assetPath = path.join(targetDir, filename);
    const assetId = path.relative(workspacePath, assetPath).split(path.sep).join('/');
    const base64Content = content.replace(/^data:[a-zA-Z0-9/+.-]+;base64,/, '');
    const buffer = Buffer.from(base64Content, 'base64');
    await fs.writeFile(assetPath, buffer);
    const metadataPath = getGlobalAssetMetadataPath(workspacePath, assetId);
    const normalizedMetadata = metadata ? (normalizeAssetMetadata(metadata) as GlobalAssetMetadata) : undefined;
    if (normalizedMetadata && Object.keys(normalizedMetadata).length > 0) {
      await fs.mkdir(path.dirname(metadataPath), { recursive: true });
      await fs.writeFile(metadataPath, JSON.stringify(normalizedMetadata, null, 2), 'utf-8');
    }

    const changedFiles = [assetId];
    if (normalizedMetadata && Object.keys(normalizedMetadata).length > 0) {
      changedFiles.push(`${assetId}.json`);
    }
    await commitGlobalAssetChanges(workspacePath, changedFiles, commitOptions);

    const asset = await this.toGlobalAsset(projectId, assetId);
    if (!asset) {
      throw new Error('Failed to resolve uploaded global asset');
    }
    return asset;
  }

  async getAbsoluteAssetPath(projectId: string, assetId: string): Promise<string | null> {
    const asset = await this.getAsset(projectId, assetId);
    if (!asset) return null;
    return path.join(await this.ensureRepository(), asset.path);
  }
}
