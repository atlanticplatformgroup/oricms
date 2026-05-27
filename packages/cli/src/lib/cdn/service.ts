/**
 * CDN Export Service - CLI version
 */

import path from 'path';
import fs from 'fs/promises';
import mime from 'mime-types';
import glob from 'fast-glob';
import type { StorageProvider, StorageConfig } from './providers.js';
import { createStorageProvider } from './providers.js';

export interface ExportOptions {
  sourcePath: string;
  destinationPrefix?: string;
  exclude?: string[];
  include?: string[];
  onProgress?: (progress: ExportProgress) => void;
}

export interface ExportProgress {
  totalFiles: number;
  uploadedFiles: number;
  failedFiles: number;
  currentFile?: string;
  percentComplete: number;
}

export interface ExportResult {
  success: boolean;
  uploaded: number;
  failed: number;
  errors: string[];
  urls: string[];
}

export class CDNExportService {
  private provider: StorageProvider;

  constructor(config: StorageConfig) {
    this.provider = createStorageProvider(config);
  }

  async export(options: ExportOptions): Promise<ExportResult> {
    const {
      sourcePath,
      destinationPrefix = '',
      exclude = ['.*', 'node_modules/**', '*.map'],
      include,
      onProgress,
    } = options;

    const errors: string[] = [];
    const urls: string[] = [];

    const files = await glob(include || '**/*', {
      cwd: sourcePath,
      onlyFiles: true,
      ignore: exclude,
      absolute: true,
    });

    const totalFiles = files.length;
    let uploadedFiles = 0;
    let failedFiles = 0;

    // Process files sequentially to show progress
    for (const filePath of files) {
      try {
        const relativePath = path.relative(sourcePath, filePath);
        const key = path.posix.join(destinationPrefix, relativePath).replace(/^\//, '');
        const contentType = mime.lookup(filePath) || 'application/octet-stream';

        // Use streaming for files > 10MB
        const stats = await fs.stat(filePath);
        let result;
        
        if (stats.size > 10 * 1024 * 1024) {
          result = await this.provider.uploadFile(key, filePath, contentType);
        } else {
          const content = await fs.readFile(filePath);
          result = await this.provider.upload(key, content, contentType);
        }

        urls.push(result.url);
        uploadedFiles++;

        onProgress?.({
          totalFiles,
          uploadedFiles,
          failedFiles,
          currentFile: relativePath,
          percentComplete: Math.round((uploadedFiles / totalFiles) * 100),
        });
      } catch (err) {
        failedFiles++;
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.push(`${filePath}: ${errorMsg}`);
      }
    }

    // Invalidate cache
    if (urls.length > 0 && this.provider.invalidateCache) {
      try {
        const keys = urls.map(url => {
          const urlObj = new URL(url);
          return urlObj.pathname.replace(/^\//, '');
        });
        await this.provider.invalidateCache(keys);
      } catch (err) {
        errors.push(`Cache invalidation failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      success: failedFiles === 0,
      uploaded: uploadedFiles,
      failed: failedFiles,
      errors,
      urls,
    };
  }

  async sync(options: ExportOptions & { deleteRemoved?: boolean }): Promise<ExportResult> {
    const {
      sourcePath,
      destinationPrefix = '',
      deleteRemoved = false,
      onProgress,
    } = options;

    // Get local files
    const localFiles = await glob('**/*', {
      cwd: sourcePath,
      onlyFiles: true,
      absolute: false,
    });

    // Get remote files
    const remoteKeys = await this.provider.list(destinationPrefix);

    // Calculate differences
    const localKeys = localFiles.map(f => path.posix.join(destinationPrefix, f));
    const toUpload = localFiles.filter(f => !remoteKeys.includes(path.posix.join(destinationPrefix, f)));
    const toDelete = deleteRemoved
      ? remoteKeys.filter(k => !localKeys.includes(k) && k.startsWith(destinationPrefix))
      : [];

    // Upload new files
    const result = await this.export({
      ...options,
      include: toUpload.length > 0 ? toUpload : ['no-match'],
    });

    // Delete removed files
    if (toDelete.length > 0) {
      await this.provider.deleteMany(toDelete);
    }

    return result;
  }

  async listFiles(prefix?: string): Promise<string[]> {
    return this.provider.list(prefix);
  }

  async deleteFiles(keys: string[]): Promise<void> {
    await this.provider.deleteMany(keys);
  }

  async cleanupDeployments(prefix: string, keepCount: number = 5): Promise<number> {
    const keys = await this.provider.list(prefix);
    
    // Group by deployment folder
    const deployments = new Map<string, string[]>();
    
    for (const key of keys) {
      const deployment = key.slice(prefix.length).split('/')[0];
      if (!deployment) continue;
      
      if (!deployments.has(deployment)) {
        deployments.set(deployment, []);
      }
      deployments.get(deployment)!.push(key);
    }

    // Sort by deployment name (timestamp-based)
    const sortedDeployments = Array.from(deployments.keys()).sort().reverse();
    const toDelete = sortedDeployments.slice(keepCount);

    for (const deployment of toDelete) {
      const keysToDelete = deployments.get(deployment) || [];
      await this.provider.deleteMany(keysToDelete);
    }

    return toDelete.length;
  }
}
