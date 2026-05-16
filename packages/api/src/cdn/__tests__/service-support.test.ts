import { describe, expect, it } from 'vitest';
import {
  buildExportProgress,
  buildExportResult,
  createExportAccumulator,
  createSyncPlan,
  getInvalidationKeys,
  groupDeploymentKeys,
  recordExportFailure,
  recordExportSuccess,
  selectDeploymentKeysToDelete,
  toStorageKey,
} from '../service-support';

describe('cdn service support', () => {
  it('normalizes storage keys without a leading slash', () => {
    expect(toStorageKey('/deployments/site', 'assets/app.js')).toBe('deployments/site/assets/app.js');
  });

  it('tracks export success and failures in a shared accumulator', () => {
    const accumulator = createExportAccumulator();
    recordExportSuccess(accumulator, 'https://cdn.example.com/deployments/site/app.js');
    recordExportFailure(accumulator, '/tmp/app.css', new Error('upload failed'));

    expect(buildExportResult(accumulator)).toEqual({
      success: false,
      uploaded: 1,
      failed: 1,
      errors: ['/tmp/app.css: upload failed'],
      urls: ['https://cdn.example.com/deployments/site/app.js'],
    });
  });

  it('builds export progress safely for empty exports', () => {
    expect(
      buildExportProgress({
        totalFiles: 0,
        uploadedFiles: 0,
        failedFiles: 0,
      })
    ).toEqual({
      totalFiles: 0,
      uploadedFiles: 0,
      failedFiles: 0,
      currentFile: undefined,
      percentComplete: 100,
    });
  });

  it('creates sync plans for missing and removed files', () => {
    expect(
      createSyncPlan({
        localFiles: ['assets/app.js', 'index.html'],
        remoteKeys: ['deployments/site/index.html', 'deployments/site/old.css'],
        destinationPrefix: 'deployments/site',
        deleteRemoved: true,
      })
    ).toEqual({
      toUpload: ['assets/app.js'],
      toDelete: ['deployments/site/old.css'],
    });
  });

  it('extracts invalidation keys from uploaded urls', () => {
    expect(
      getInvalidationKeys([
        'https://cdn.example.com/deployments/site/index.html',
        'https://cdn.example.com/deployments/site/assets/app.js',
      ])
    ).toEqual(['deployments/site/index.html', 'deployments/site/assets/app.js']);
  });

  it('groups deployments and selects older keys for cleanup', () => {
    const deployments = groupDeploymentKeys(
      [
        'deployments/20260326/index.html',
        'deployments/20260327/index.html',
        'deployments/20260328/index.html',
      ],
      'deployments/'
    );

    expect(Array.from(deployments.keys())).toEqual(['20260326', '20260327', '20260328']);
    expect(selectDeploymentKeysToDelete(deployments, 2)).toEqual(['deployments/20260326/index.html']);
  });
});
