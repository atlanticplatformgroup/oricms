import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assetsApi, globalAssetsApi } from '../assets';
import * as core from '../core';

describe('assetsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists assets with string folder', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({
      assets: [],
      pagination: { total: 0, limit: null, offset: 0, hasMore: false },
      facets: { tags: [], usage: { used: 0, unused: 0 } },
    });

    await assetsApi.list('p1', 'images');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/assets?folder=images');
  });

  it('lists assets with options object', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({
      assets: [],
      pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
      facets: { tags: [], usage: { used: 0, unused: 0 } },
    });

    await assetsApi.list('p1', { folder: 'documents', search: 'logo', sort: 'name', limit: 20, offset: 0, usage: 'unused' });
    expect(requestSpy).toHaveBeenCalledWith(
      '/api/v1/projects/p1/assets?folder=documents&usage=unused&search=logo&sort=name&limit=20&offset=0',
    );
  });

  it('gets an asset', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ asset: { path: 'img.png' } });

    const result = await assetsApi.get('p1', 'img.png');
    expect(result.asset.path).toBe('img.png');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/assets/img.png');
  });

  it('uploads an asset', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ asset: { path: 'new.png' } });

    await assetsApi.upload('p1', 'new.png', 'base64...', 'images');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/assets/upload', {
      method: 'POST',
      body: { filename: 'new.png', content: 'base64...', folder: 'images', metadata: undefined },
    });
  });

  it('deletes an asset', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce(undefined);

    await assetsApi.delete('p1', 'img.png');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/assets/img.png', { method: 'DELETE' });
  });

  it('updates metadata', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ metadata: { title: 'T' } });

    await assetsApi.updateMetadata('p1', 'img.png', { title: 'T' });
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/assets/metadata/img.png', {
      method: 'PUT',
      body: expect.any(Object),
    });
  });
});

describe('globalAssetsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists global assets', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ assets: [] });

    await globalAssetsApi.list('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/global-assets');
  });

  it('gets a global asset', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ asset: { assetId: 'ga1' } as any });

    const result = await globalAssetsApi.get('p1', 'ga1');
    expect(result.asset.assetId).toBe('ga1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/global-assets/ga1');
  });

  it('uploads a global asset', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ asset: { id: 'ga2' } });

    await globalAssetsApi.upload('p1', 'file.png', 'base64...', 'images', ['tag1']);
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/global-assets/upload', {
      method: 'POST',
      body: { filename: 'file.png', content: 'base64...', folder: 'images', tags: ['tag1'] },
    });
  });

  it('deletes a global asset', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce(undefined);

    await globalAssetsApi.delete('p1', 'ga1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/global-assets/ga1', { method: 'DELETE' });
  });
});
