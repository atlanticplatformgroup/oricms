/**
 * Git Asset Service - Manage assets in git repository
 * 
 * Assets are stored in the git repo under assets/ directory
 * This keeps everything version controlled and in sync.
 * 
 * Supports metadata sidecars (*.json) for Alt-text, Captions, and Virtual Tags.
 */

import * as fs from 'fs/promises';
import { GitService } from '../git/service';
import { prisma } from '../lib/prisma';
import type { AssetMetadata } from '@ori/shared';
import {
  getProjectAsset,
  listProjectAssets,
} from './asset-read-operations';
import {
  getProjectAssetDirectory,
  getProjectAssetFolderPath,
  getProjectAssetUrl,
  getAssetWorkspacePath,
} from './asset-paths';
import {
  deleteAssetFiles,
  getAssetType,
  readAssetContentDataUrl,
  readAssetMetadata,
  renameAssetFiles,
  updateAssetMetadataInGit,
  uploadAssetFiles,
} from './asset-file-operations';
import type { Asset, AssetListOptions, AssetListResult, CommitOptions } from './types';

export type { Asset, AssetListOptions, AssetListResult } from './types';

export class GitAssetService {
  private gitService: GitService;

  constructor() {
    this.gitService = new GitService();
  }

  private getAssetPath(projectId: string): string {
    return getProjectAssetDirectory(projectId);
  }

  private getWorkspacePath(projectId: string): string {
    return getAssetWorkspacePath(projectId);
  }

  private async getProjectSettings(projectId: string): Promise<Record<string, unknown>> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { settings: true },
    });
    return (project?.settings as Record<string, unknown>) || {};
  }

  private async getMetadata(projectId: string, assetPath: string): Promise<AssetMetadata | undefined> {
    return readAssetMetadata(this.getWorkspacePath(projectId), assetPath);
  }

  /**
   * Update asset metadata
   */
  async updateMetadata(
    projectId: string,
    assetPath: string,
    metadata: AssetMetadata,
    commitOptions: CommitOptions
  ): Promise<AssetMetadata> {
    await this.gitService.ensureCloned(projectId);

    return updateAssetMetadataInGit({
      workspacePath: this.getWorkspacePath(projectId),
      assetPath,
      metadata,
      commitOptions,
    });
  }

  /**
   * Ensure the assets directory exists
   */
  private async ensureAssetsDir(projectId: string, folder: string): Promise<string> {
    const assetPath = getProjectAssetFolderPath(projectId, folder);
    await fs.mkdir(assetPath, { recursive: true });
    return assetPath;
  }

  async listAssets(projectId: string, options: string | AssetListOptions = 'images'): Promise<AssetListResult> {
    const normalized: AssetListOptions = typeof options === 'string' ? { folder: options } : options;
    await this.gitService.ensureCloned(projectId);
    return listProjectAssets({
      projectId,
      workspacePath: this.getWorkspacePath(projectId),
      projectSettings: await this.getProjectSettings(projectId),
      options: normalized,
    });
  }

  /**
   * Upload a new asset
   */
  async uploadAsset(
    projectId: string,
    folder: string,
    filename: string,
    content: string, // base64 data URL
    metadata: AssetMetadata | undefined,
    commitOptions: CommitOptions
  ): Promise<Asset> {
    await this.gitService.ensureCloned(projectId);
    const upload = await uploadAssetFiles({
      projectId,
      workspacePath: this.getWorkspacePath(projectId),
      assetDir: await this.ensureAssetsDir(projectId, folder),
      folder,
      filename,
      content,
      metadata,
      commitOptions,
    });

    return {
      path: upload.relativePath,
      name: filename,
      folder,
      size: upload.stat.size,
      type: getAssetType(filename),
      url: getProjectAssetUrl(projectId, upload.relativePath),
      lastModified: upload.stat.mtime.toISOString(),
      metadata: upload.normalizedMetadata,
    };
  }

  /**
   * Get asset metadata and content
   */
  async getAsset(projectId: string, assetPath: string): Promise<Asset | null> {
    await this.gitService.ensureCloned(projectId);
    return getProjectAsset({
      projectId,
      workspacePath: this.getWorkspacePath(projectId),
      projectSettings: await this.getProjectSettings(projectId),
      assetPath,
    });
  }

  /**
   * Delete an asset
   */
  async deleteAsset(
    projectId: string,
    assetPath: string,
    commitOptions: CommitOptions
  ): Promise<void> {
    await this.gitService.ensureCloned(projectId);

    await deleteAssetFiles({
      workspacePath: this.getWorkspacePath(projectId),
      assetPath,
      commitOptions,
    });
  }

  /**
   * Get asset content as base64
   */
  async getAssetContent(projectId: string, assetPath: string): Promise<string | null> {
    await this.gitService.ensureCloned(projectId);

    return readAssetContentDataUrl(this.getWorkspacePath(projectId), assetPath);
  }

  /**
   * Rename/move an asset
   */
  async renameAsset(
    projectId: string,
    oldPath: string,
    newPath: string,
    commitOptions: CommitOptions
  ): Promise<void> {
    await this.gitService.ensureCloned(projectId);

    await renameAssetFiles({
      workspacePath: this.getWorkspacePath(projectId),
      oldPath,
      newPath,
      commitOptions,
    });
  }
}
