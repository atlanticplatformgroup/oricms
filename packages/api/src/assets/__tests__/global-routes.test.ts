import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const {
  listGlobalAssetsMock,
  getGlobalAssetMock,
  uploadGlobalAssetMock,
  getAbsoluteAssetPathMock,
  updateGlobalAssetMetadataMock,
  deleteGlobalAssetMock,
} = vi.hoisted(() => ({
  listGlobalAssetsMock: vi.fn(),
  getGlobalAssetMock: vi.fn(),
  uploadGlobalAssetMock: vi.fn(),
  getAbsoluteAssetPathMock: vi.fn(),
  updateGlobalAssetMetadataMock: vi.fn(),
  deleteGlobalAssetMock: vi.fn(),
}));

vi.mock('../../permissions/middleware', () => ({
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../global-service', () => ({
  GlobalAssetService: vi.fn().mockImplementation(() => ({
    listAssets: listGlobalAssetsMock,
    getAsset: getGlobalAssetMock,
    uploadAsset: uploadGlobalAssetMock,
    getAbsoluteAssetPath: getAbsoluteAssetPathMock,
    updateMetadata: updateGlobalAssetMetadataMock,
    deleteAsset: deleteGlobalAssetMock,
  })),
}));

import router from '../global-routes';

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as express.Request & { user?: unknown }).user = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
  };
  next();
});
app.use('/api/v1/projects/:projectId/global-assets', router);

describe('Global asset routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listGlobalAssetsMock.mockResolvedValue({
      assets: [
        {
          assetId: 'brand/logo-primary.png',
          scope: 'global',
          path: 'brand/logo-primary.png',
          name: 'logo-primary.png',
          folder: 'brand',
          size: 1337,
          type: 'image',
          url: '/api/v1/projects/project-1/global-assets/raw/brand/logo-primary.png',
          lastModified: '2026-03-12T00:00:00.000Z',
          metadata: { tags: ['brand'] },
        },
      ],
    });
  });

  it('lists global assets for a project-scoped request', async () => {
    const response = await request(app).get('/api/v1/projects/project-1/global-assets');

    expect(response.status).toBe(200);
    expect(listGlobalAssetsMock).toHaveBeenCalledWith('project-1');
    expect(response.body.data.assets[0]).toMatchObject({
      assetId: 'brand/logo-primary.png',
      scope: 'global',
      name: 'logo-primary.png',
    });
  });

  it('returns a single global asset by asset id', async () => {
    getGlobalAssetMock.mockResolvedValue({
      assetId: 'brand/logo-primary.png',
      scope: 'global',
      path: 'brand/logo-primary.png',
      name: 'logo-primary.png',
      folder: 'brand',
      size: 1337,
      type: 'image',
      url: '/api/v1/projects/project-1/global-assets/raw/brand/logo-primary.png',
      lastModified: '2026-03-12T00:00:00.000Z',
      metadata: { tags: ['brand'] },
    });

    const response = await request(app).get('/api/v1/projects/project-1/global-assets/brand%2Flogo-primary.png');

    expect(response.status).toBe(200);
    expect(getGlobalAssetMock).toHaveBeenCalledWith('project-1', 'brand/logo-primary.png');
    expect(response.body.data.asset.assetId).toBe('brand/logo-primary.png');
  });

  it('uploads a global asset', async () => {
    uploadGlobalAssetMock.mockResolvedValue({
      assetId: 'brand/logo-primary.png',
      scope: 'global',
      path: 'brand/logo-primary.png',
      name: 'logo-primary.png',
      folder: 'brand',
      size: 1337,
      type: 'image',
      url: '/api/v1/projects/project-1/global-assets/raw/brand/logo-primary.png',
      lastModified: '2026-03-12T00:00:00.000Z',
      metadata: { tags: ['brand'] },
    });

    const response = await request(app)
      .post('/api/v1/projects/project-1/global-assets/upload')
      .send({
        filename: 'logo-primary.png',
        folder: 'brand',
        tags: ['logos'],
        content: 'data:image/png;base64,aGVsbG8=',
      });

    expect(response.status).toBe(201);
    expect(uploadGlobalAssetMock).toHaveBeenCalledWith(
      'project-1',
      'brand',
      'logo-primary.png',
      'data:image/png;base64,aGVsbG8=',
      { tags: ['logos'] },
      expect.objectContaining({
        author: expect.objectContaining({ email: 'test@example.com' }),
        message: 'Upload global asset logo-primary.png',
      }),
    );
    expect(response.body.data.asset.scope).toBe('global');
  });

  it('updates global asset metadata', async () => {
    updateGlobalAssetMetadataMock.mockResolvedValue({
      assetId: 'brand/logo-primary.png',
      scope: 'global',
      path: 'brand/logo-primary.png',
      name: 'logo-primary.png',
      folder: 'brand',
      size: 1337,
      type: 'image',
      url: '/api/v1/projects/project-1/global-assets/raw/brand/logo-primary.png',
      lastModified: '2026-03-12T00:00:00.000Z',
      metadata: { altText: 'Primary logo', tags: ['brand'] },
    });

    const response = await request(app)
      .put('/api/v1/projects/project-1/global-assets/metadata/brand%2Flogo-primary.png')
      .send({ altText: 'Primary logo', tags: ['brand'] });

    expect(response.status).toBe(200);
    expect(updateGlobalAssetMetadataMock).toHaveBeenCalledWith(
      'project-1',
      'brand/logo-primary.png',
      { altText: 'Primary logo', tags: ['brand'] },
      expect.objectContaining({
        author: expect.objectContaining({ email: 'test@example.com' }),
        message: 'Update global asset metadata logo-primary.png',
      }),
    );
    expect(response.body.data.metadata).toEqual({ altText: 'Primary logo', tags: ['brand'] });
  });

  it('deletes a global asset', async () => {
    deleteGlobalAssetMock.mockResolvedValue(undefined);

    const response = await request(app)
      .delete('/api/v1/projects/project-1/global-assets/brand%2Flogo-primary.png');

    expect(response.status).toBe(200);
    expect(deleteGlobalAssetMock).toHaveBeenCalledWith(
      'project-1',
      'brand/logo-primary.png',
      expect.objectContaining({
        author: expect.objectContaining({ email: 'test@example.com' }),
        message: 'Delete global asset logo-primary.png',
      }),
    );
    expect(response.body.data).toEqual({ deleted: true });
  });
});
