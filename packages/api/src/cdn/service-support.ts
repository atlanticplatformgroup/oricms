import path from 'path';
import glob from 'fast-glob';
import type { ExportProgress, ExportResult } from './types';

export const DEFAULT_EXPORT_EXCLUDE = ['.*', 'node_modules/**', '*.map'];
export const DEFAULT_STREAMING_EXCLUDE = ['.*', 'node_modules/**'];
export const EXPORT_BATCH_SIZE = 10;

interface ExportAccumulator {
  errors: string[];
  urls: string[];
  uploadedFiles: number;
  failedFiles: number;
}

export interface SyncPlan {
  toUpload: string[];
  toDelete: string[];
}

export async function listExportFiles(
  sourcePath: string,
  input: {
    include?: string[];
    exclude: string[];
    absolute: boolean;
  }
): Promise<string[]> {
  return glob(input.include || '**/*', {
    cwd: sourcePath,
    onlyFiles: true,
    ignore: input.exclude,
    absolute: input.absolute,
  });
}

export function createExportAccumulator(): ExportAccumulator {
  return {
    errors: [],
    urls: [],
    uploadedFiles: 0,
    failedFiles: 0,
  };
}

export function toStorageKey(destinationPrefix: string, relativePath: string): string {
  return path.posix.join(destinationPrefix, relativePath).replace(/^\//, '');
}

export function recordExportSuccess(
  accumulator: ExportAccumulator,
  url: string
): ExportAccumulator {
  accumulator.urls.push(url);
  accumulator.uploadedFiles += 1;
  return accumulator;
}

export function recordExportFailure(
  accumulator: ExportAccumulator,
  filePath: string,
  error: unknown
): ExportAccumulator {
  accumulator.failedFiles += 1;
  const errorMsg = error instanceof Error ? error.message : String(error);
  accumulator.errors.push(`${filePath}: ${errorMsg}`);
  return accumulator;
}

export function buildExportProgress(input: {
  totalFiles: number;
  uploadedFiles: number;
  failedFiles: number;
  currentFile?: string;
}): ExportProgress {
  const { totalFiles, uploadedFiles, failedFiles, currentFile } = input;
  return {
    totalFiles,
    uploadedFiles,
    failedFiles,
    currentFile,
    percentComplete: totalFiles === 0 ? 100 : Math.round((uploadedFiles / totalFiles) * 100),
  };
}

export function buildExportResult(accumulator: ExportAccumulator): ExportResult {
  return {
    success: accumulator.failedFiles === 0,
    uploaded: accumulator.uploadedFiles,
    failed: accumulator.failedFiles,
    errors: accumulator.errors,
    urls: accumulator.urls,
  };
}

export function getInvalidationKeys(urls: string[]): string[] {
  return urls.map((url) => {
    const urlObj = new URL(url);
    return urlObj.pathname.replace(/^\//, '');
  });
}

export function createSyncPlan(input: {
  localFiles: string[];
  remoteKeys: string[];
  destinationPrefix: string;
  deleteRemoved: boolean;
}): SyncPlan {
  const { localFiles, remoteKeys, destinationPrefix, deleteRemoved } = input;
  const localKeys = localFiles.map((file) => toStorageKey(destinationPrefix, file));
  return {
    toUpload: localFiles.filter(
      (file) => !remoteKeys.includes(toStorageKey(destinationPrefix, file))
    ),
    toDelete: deleteRemoved
      ? remoteKeys.filter(
          (key) => !localKeys.includes(key) && key.startsWith(destinationPrefix)
        )
      : [],
  };
}

export function groupDeploymentKeys(keys: string[], prefix: string): Map<string, string[]> {
  const deployments = new Map<string, string[]>();

  for (const key of keys) {
    const deployment = key.slice(prefix.length).split('/')[0];
    if (!deployment) {
      continue;
    }

    if (!deployments.has(deployment)) {
      deployments.set(deployment, []);
    }
    deployments.get(deployment)!.push(key);
  }

  return deployments;
}

export function selectDeploymentKeysToDelete(
  deployments: Map<string, string[]>,
  keepCount: number
): string[] {
  return Array.from(deployments.keys())
    .sort()
    .reverse()
    .slice(keepCount)
    .flatMap((deployment) => deployments.get(deployment) || []);
}
