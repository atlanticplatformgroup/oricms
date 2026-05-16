import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import mime from 'mime-types';
import type { StorageProvider, StorageConfig } from './providers';
import { createStorageProvider } from './providers';
import {
  buildExportProgress,
  buildExportResult,
  createExportAccumulator,
  createSyncPlan,
  DEFAULT_EXPORT_EXCLUDE,
  DEFAULT_STREAMING_EXCLUDE,
  EXPORT_BATCH_SIZE,
  getInvalidationKeys,
  groupDeploymentKeys,
  listExportFiles,
  recordExportFailure,
  recordExportSuccess,
  selectDeploymentKeysToDelete,
  toStorageKey,
} from './service-support';
import type { ExportJob, ExportOptions, ExportResult } from './types';
export type { ExportJob, ExportOptions, ExportProgress, ExportResult } from './types';

/**
 * CDN Export Service
 */
export class CDNExportService {
  private provider: StorageProvider;
  private activeJobs: Map<string, ExportJob> = new Map();

  constructor(config: StorageConfig) {
    this.provider = createStorageProvider(config);
  }

  /**
   * Export files from local path to CDN
   */
  async export(options: ExportOptions): Promise<ExportResult> {
    const {
      sourcePath,
      destinationPrefix = '',
      exclude = DEFAULT_EXPORT_EXCLUDE,
      include,
      onProgress,
    } = options;

    const accumulator = createExportAccumulator();
    const files = await listExportFiles(sourcePath, {
      include,
      exclude,
      absolute: true,
    });

    const totalFiles = files.length;
    const batches = chunkArray(files, EXPORT_BATCH_SIZE);

    for (const batch of batches) {
      await Promise.all(
        batch.map(async (filePath) => {
          try {
            const relativePath = path.relative(sourcePath, filePath);
            const key = toStorageKey(destinationPrefix, relativePath);
            const contentType = mime.lookup(filePath) || 'application/octet-stream';

            const content = await fs.readFile(filePath);
            const result = await this.provider.upload(key, content, contentType);

            recordExportSuccess(accumulator, result.url);

            onProgress?.(buildExportProgress({
              totalFiles,
              uploadedFiles: accumulator.uploadedFiles,
              failedFiles: accumulator.failedFiles,
              currentFile: relativePath,
            }));
          } catch (err) {
            recordExportFailure(accumulator, filePath, err);
          }
        })
      );
    }

    if (accumulator.urls.length > 0 && this.provider.invalidateCache) {
      try {
        await this.provider.invalidateCache(getInvalidationKeys(accumulator.urls));
      } catch (err) {
        accumulator.errors.push(
          `Cache invalidation failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return buildExportResult(accumulator);
  }

  /**
   * Export with streaming (for large files)
   */
  async exportStreaming(options: ExportOptions): Promise<ExportResult> {
    const {
      sourcePath,
      destinationPrefix = '',
      exclude = DEFAULT_STREAMING_EXCLUDE,
      onProgress,
    } = options;

    const accumulator = createExportAccumulator();
    const files = await listExportFiles(sourcePath, {
      exclude,
      absolute: true,
    });

    const totalFiles = files.length;

    for (const filePath of files) {
      try {
        const relativePath = path.relative(sourcePath, filePath);
        const key = toStorageKey(destinationPrefix, relativePath);
        const contentType = mime.lookup(filePath) || 'application/octet-stream';
        const stats = await stat(filePath);

        const stream = createReadStream(filePath);
        const result = await this.provider.uploadStream(key, stream, contentType, stats.size);

        recordExportSuccess(accumulator, result.url);

        onProgress?.(buildExportProgress({
          totalFiles,
          uploadedFiles: accumulator.uploadedFiles,
          failedFiles: accumulator.failedFiles,
          currentFile: relativePath,
        }));
      } catch (err) {
        recordExportFailure(accumulator, filePath, err);
      }
    }

    return buildExportResult(accumulator);
  }

  /**
   * Sync directory - upload new/changed files, delete removed ones
   */
  async sync(options: ExportOptions & { deleteRemoved?: boolean }): Promise<ExportResult> {
    const {
      sourcePath,
      destinationPrefix = '',
      deleteRemoved = false,
    } = options;

    const localFiles = await listExportFiles(sourcePath, {
      exclude: [],
      absolute: false,
    });
    const remoteKeys = await this.provider.list(destinationPrefix);
    const { toUpload, toDelete } = createSyncPlan({
      localFiles,
      remoteKeys,
      destinationPrefix,
      deleteRemoved,
    });

    const uploadResult = await this.export({
      ...options,
      include: toUpload.length > 0 ? toUpload : ['no-match'],
    });

    if (toDelete.length > 0) {
      await this.provider.deleteMany(toDelete);
    }

    return {
      ...uploadResult,
      uploaded: uploadResult.uploaded,
    };
  }

  /**
   * Clean up old deployments (keep last N)
   */
  async cleanupDeployments(prefix: string, keepCount: number = 5): Promise<void> {
    const keys = await this.provider.list(prefix);
    const deployments = groupDeploymentKeys(keys, prefix);
    const keysToDelete = selectDeploymentKeysToDelete(deployments, keepCount);

    if (keysToDelete.length > 0) {
      await this.provider.deleteMany(keysToDelete);
    }
  }

  /**
   * Get job status
   */
  getJob(jobId: string): ExportJob | undefined {
    return this.activeJobs.get(jobId);
  }
}

// Helper
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
