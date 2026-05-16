import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const {
  listAssetsMock,
  getAssetMock,
  uploadAssetFlowMock,
  updateAssetMetadataFlowMock,
  deleteAssetFlowMock,
} = vi.hoisted(() => ({
  listAssetsMock: vi.fn(),
  getAssetMock: vi.fn(),
  uploadAssetFlowMock: vi.fn(),
  updateAssetMetadataFlowMock: vi.fn(),
  deleteAssetFlowMock: vi.fn(),
}));

vi.mock('../../permissions/middleware', () => ({
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../service', () => ({
  GitAssetService: vi.fn().mockImplementation(() => ({
    listAssets: listAssetsMock,
    getAsset: getAssetMock,
  })),
}));

vi.mock('../../application/assets/upload-asset', () => ({
  uploadAsset: (...args: unknown[]) => uploadAssetFlowMock(...args),
}));

vi.mock('../../application/assets/update-asset-metadata', () => ({
  updateAssetMetadata: (...args: unknown[]) => updateAssetMetadataFlowMock(...args),
}));

vi.mock('../../application/assets/delete-asset', () => ({
  deleteAsset: (...args: unknown[]) => deleteAssetFlowMock(...args),
}));

import router from '../routes';

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
app.use('/api/v1/projects/:projectId/assets', router);

describe('Asset routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAssetsMock.mockResolvedValue({
      assets: [
        {
          path: 'assets/images/hero.png',
          name: 'hero.png',
          folder: 'images',
          size: 42,
          type: 'image',
          url: '/api/v1/projects/project-1/assets/raw/assets/images/hero.png',
          lastModified: '2026-03-09T00:00:00.000Z',
          metadata: { tags: ['homepage'] },
        },
      ],
      pagination: {
        total: 12,
        limit: 5,
        offset: 5,
        hasMore: true,
      },
      facets: {
        tags: [
          { value: 'homepage', label: 'homepage', count: 2 },
          { value: '__untagged__', label: 'Untagged', count: 1 },
        ],
        usage: {
          used: 8,
          unused: 4,
        },
      },
    });
  });

  it('lists paginated assets with search, usage, sort, and tag filters', async () => {
    const response = await request(app)
      .get('/api/v1/projects/project-1/assets')
      .query({
        folder: 'all',
        tag: 'homepage',
        usage: 'used',
        search: 'hero',
        sort: 'name',
        limit: '5',
        offset: '5',
      });

    expect(response.status).toBe(200);
    expect(listAssetsMock).toHaveBeenCalledWith('project-1', {
      folder: 'all',
      tag: 'homepage',
      usage: 'used',
      search: 'hero',
      sort: 'name',
      limit: 5,
      offset: 5,
    });
    expect(response.body.data.pagination).toEqual({
      total: 12,
      limit: 5,
      offset: 5,
      hasMore: true,
    });
    expect(response.body.data.facets.tags).toEqual([
      { value: 'homepage', label: 'homepage', count: 2 },
      { value: '__untagged__', label: 'Untagged', count: 1 },
    ]);
    expect(response.body.data.facets.usage).toEqual({
      used: 8,
      unused: 4,
    });
  });

  it('returns asset usage details for a single asset', async () => {
    getAssetMock.mockResolvedValue({
      path: 'assets/images/hero.png',
      name: 'hero.png',
      folder: 'images',
      size: 42,
      type: 'image',
      url: '/api/v1/projects/project-1/assets/raw/assets/images/hero.png',
      lastModified: '2026-03-09T00:00:00.000Z',
      metadata: { tags: ['homepage'] },
      usage: { count: 2, status: 'used' },
      usageDetail: {
        references: [
          {
            collectionId: 'posts',
            collectionLabel: 'Posts',
            entryId: 'post-1',
            entryLabel: 'Welcome',
            entryPath: 'content/posts/post-1.json',
          },
        ],
      },
    });

    const response = await request(app).get('/api/v1/projects/project-1/assets/assets/images/hero.png');

    expect(response.status).toBe(200);
    expect(getAssetMock).toHaveBeenCalledWith('project-1', 'assets/images/hero.png');
    expect(response.body.data.asset.usage).toEqual({ count: 2, status: 'used' });
    expect(response.body.data.asset.usageDetail.references).toEqual([
      {
        collectionId: 'posts',
        collectionLabel: 'Posts',
        entryId: 'post-1',
        entryLabel: 'Welcome',
        entryPath: 'content/posts/post-1.json',
      },
    ]);
  });

  it('passes initial metadata through the upload flow', async () => {
    uploadAssetFlowMock.mockResolvedValue({
      asset: {
        path: 'assets/images/hero.png',
        name: 'hero.png',
        folder: 'images',
        size: 42,
        type: 'image',
        url: '/api/v1/projects/project-1/assets/raw/assets/images/hero.png',
        lastModified: '2026-03-09T00:00:00.000Z',
        metadata: { tags: ['homepage'] },
      },
    });

    const response = await request(app)
      .post('/api/v1/projects/project-1/assets/upload')
      .send({
        filename: 'hero.png',
        content: 'data:image/png;base64,AAAA',
        folder: 'images',
        metadata: { tags: ['homepage'] },
      });

    expect(response.status).toBe(201);
    expect(uploadAssetFlowMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        folder: 'images',
        filename: 'hero.png',
        metadata: { tags: ['homepage'] },
      }),
      expect.anything(),
      expect.anything(),
    );
  });
});
