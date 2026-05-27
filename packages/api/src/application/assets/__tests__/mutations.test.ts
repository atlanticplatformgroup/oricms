import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PLUGIN_EVENT_NAMES } from '@ori/shared';

const {
  uploadAssetMock,
  updateMetadataMock,
  deleteAssetMock,
  auditCreateMock,
  dispatchLifecycleEventMock,
  dispatchPluginHookMock,
  lifecycleHookErrorClass,
} = vi.hoisted(() => ({
  uploadAssetMock: vi.fn(),
  updateMetadataMock: vi.fn(),
  deleteAssetMock: vi.fn(),
  auditCreateMock: vi.fn(),
  dispatchLifecycleEventMock: vi.fn(),
  dispatchPluginHookMock: vi.fn(),
  lifecycleHookErrorClass: class LifecycleHookError extends Error {},
}));

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: auditCreateMock,
    },
  },
}));

vi.mock('../../../plugins/dispatcher', () => ({
  dispatchLifecycleEvent: (...args: unknown[]) => dispatchLifecycleEventMock(...args),
  LifecycleHookError: lifecycleHookErrorClass,
}));

vi.mock('../../../plugins/hook-dispatcher', () => ({
  dispatchPluginHook: (...args: unknown[]) => dispatchPluginHookMock(...args),
}));

import { uploadAsset } from '../upload-asset';
import { updateAssetMetadata } from '../update-asset-metadata';
import { deleteAsset } from '../delete-asset';

describe('asset application services', () => {
  const context = {
    projectId: 'project-1',
    actor: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    uploadAssetMock.mockResolvedValue({ path: 'assets/images/hero.png', size: 42, name: 'hero.png', folder: 'images', type: 'image', url: '/api/v1/projects/project-1/assets/raw/assets/images/hero.png', lastModified: '2026-03-09T00:00:00.000Z' });
    updateMetadataMock.mockResolvedValue({ altText: 'Hero' });
    deleteAssetMock.mockResolvedValue(undefined);
    auditCreateMock.mockResolvedValue({});
    dispatchLifecycleEventMock.mockResolvedValue(undefined);
    dispatchPluginHookMock.mockResolvedValue(undefined);
  });

  it('uploads an asset and dispatches lifecycle/plugin hooks', async () => {
    const result = await uploadAsset(context, { folder: 'images', filename: 'hero.png', content: 'data:image/png;base64,AAAA', metadata: { tags: ['homepage'] } }, {
      audit: { userId: 'user-1', action: 'asset.upload' },
    }, {
      assetService: { uploadAsset: uploadAssetMock, updateMetadata: updateMetadataMock, deleteAsset: deleteAssetMock },
    });

    expect(result.assetPath).toBe('assets/images/hero.png');
    expect(uploadAssetMock).toHaveBeenCalledWith(
      'project-1',
      'images',
      'hero.png',
      'data:image/png;base64,AAAA',
      { tags: ['homepage'] },
      expect.anything(),
    );
    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('asset.beforeCreate', expect.objectContaining({ filename: 'hero.png' }));
    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('asset.afterCreate', expect.objectContaining({ assetPath: 'assets/images/hero.png' }));
    expect(dispatchPluginHookMock).toHaveBeenCalledWith(expect.objectContaining({ event: PLUGIN_EVENT_NAMES.ASSET_CREATED }));
  });

  it('lets beforeCreate block asset upload', async () => {
    dispatchLifecycleEventMock.mockRejectedValueOnce(new lifecycleHookErrorClass('blocked'));

    await expect(uploadAsset(context, { folder: 'images', filename: 'hero.png', content: 'data:image/png;base64,AAAA' }, {}, {
      assetService: { uploadAsset: uploadAssetMock, updateMetadata: updateMetadataMock, deleteAsset: deleteAssetMock },
    })).rejects.toThrow('blocked');
    expect(uploadAssetMock).not.toHaveBeenCalled();
  });

  it('updates asset metadata and dispatches lifecycle/plugin hooks', async () => {
    await updateAssetMetadata(context, 'assets/images/hero.png', { altText: 'Hero' }, {
      audit: { userId: 'user-1', action: 'asset.updateMetadata' },
    }, {
      assetService: { uploadAsset: uploadAssetMock, updateMetadata: updateMetadataMock, deleteAsset: deleteAssetMock },
    });

    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('asset.beforeUpdate', expect.objectContaining({ assetPath: 'assets/images/hero.png' }));
    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('asset.afterUpdate', expect.objectContaining({ assetPath: 'assets/images/hero.png' }));
    expect(dispatchPluginHookMock).toHaveBeenCalledWith(expect.objectContaining({ event: PLUGIN_EVENT_NAMES.ASSET_UPDATED }));
  });

  it('deletes an asset and dispatches lifecycle/plugin hooks', async () => {
    await deleteAsset(context, 'assets/images/hero.png', {
      audit: { userId: 'user-1', action: 'asset.delete' },
    }, {
      assetService: { uploadAsset: uploadAssetMock, updateMetadata: updateMetadataMock, deleteAsset: deleteAssetMock },
    });

    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('asset.beforeDelete', expect.objectContaining({ assetPath: 'assets/images/hero.png' }));
    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('asset.afterDelete', expect.objectContaining({ assetPath: 'assets/images/hero.png' }));
    expect(dispatchPluginHookMock).toHaveBeenCalledWith(expect.objectContaining({ event: PLUGIN_EVENT_NAMES.ASSET_DELETED }));
  });
});
