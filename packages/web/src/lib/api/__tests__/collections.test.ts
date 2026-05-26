import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contentTypesApi, collectionsApi } from '../collections';
import * as core from '../core';

describe('contentTypesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists content types', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ contentTypes: [] });
    await contentTypesApi.list('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/content-types');
  });

  it('gets a content type', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ contentType: { id: 'ct1' } });
    const result = await contentTypesApi.get('p1', 'ct1');
    expect(result.contentType.id).toBe('ct1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/content-types/ct1');
  });

  it('creates a content type', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce(undefined);
    await contentTypesApi.create('p1', { name: 'Post' });
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/content-types', {
      method: 'POST',
      body: { name: 'Post' },
    });
  });

  it('updates a content type', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce(undefined);
    await contentTypesApi.update('p1', 'ct1', { name: 'Updated' });
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/content-types/ct1', {
      method: 'PUT',
      body: { name: 'Updated' },
    });
  });

  it('deletes a content type', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce(undefined);
    await contentTypesApi.delete('p1', 'ct1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/content-types/ct1', { method: 'DELETE' });
  });
});

describe('collectionsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists collections', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ collections: [] });
    await collectionsApi.list('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/schemas');
  });

  it('updates config', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce(undefined);
    await collectionsApi.updateConfig('p1', [{ id: 'c1' } as any]);
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/schemas', {
      method: 'PUT',
      body: { schemas: [{ id: 'c1' }] },
      headers: undefined,
    });
  });

  it('deletes a collection', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce(undefined);
    await collectionsApi.deleteCollection('p1', 'c1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/schemas/c1', { method: 'DELETE', headers: undefined });
  });

  it('lists entries with query', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ entries: [], pagination: { total: 0 } });
    await collectionsApi.listEntries('p1', 'c1', { filter: { status: 'published' }, sort: { createdAt: 'desc' }, page: 1, limit: 10, search: 'q' });
    expect(requestSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/projects/p1/schemas/c1/entries'),
    );
    const url = requestSpy.mock.calls[0][0] as string;
    expect(url).toContain('filter=%7B%22status%22%3A%22published%22%7D');
    expect(url).toContain('sort=%7B%22createdAt%22%3A%22desc%22%7D');
    expect(url).toContain('page=1');
    expect(url).toContain('limit=10');
    expect(url).toContain('search=q');
  });

  it('gets an entry', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ entry: { id: 'e1' } });
    const result = await collectionsApi.getEntry('p1', 'c1', 'e1');
    expect(result.entry.id).toBe('e1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/schemas/c1/entries/e1');
  });

  it('creates an entry', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ entry: { id: 'e1' } });
    await collectionsApi.createEntry('p1', 'c1', { title: 'T' });
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/schemas/c1/entries', {
      method: 'POST',
      body: { title: 'T' },
    });
  });

  it('updates an entry with baseRevision', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ entry: { id: 'e1' } });
    await collectionsApi.updateEntry('p1', 'c1', 'e1', { title: 'T' }, 'rev1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/schemas/c1/entries/e1', {
      method: 'PUT',
      body: { title: 'T', baseRevision: 'rev1' },
    });
  });

  it('deletes an entry without baseRevision', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce(undefined);
    await collectionsApi.deleteEntry('p1', 'c1', 'e1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/schemas/c1/entries/e1', { method: 'DELETE' });
  });

  it('deletes an entry with baseRevision', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce(undefined);
    await collectionsApi.deleteEntry('p1', 'c1', 'e1', 'rev1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/schemas/c1/entries/e1', {
      method: 'DELETE',
      body: { baseRevision: 'rev1' },
    });
  });

  it('gets entry history', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ history: [] });
    await collectionsApi.getEntryHistory('p1', 'c1', 'e1', 'main');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/schemas/c1/entries/e1/history?branch=main');
  });

  it('gets entry version', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ entry: { id: 'e1' } });
    const result = await collectionsApi.getEntryVersion('p1', 'c1', 'e1', 'abc', 'main');
    expect(result.entry.id).toBe('e1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/schemas/c1/entries/e1/history/abc?branch=main');
  });

  it('previews branch transfer', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ conflicts: [] });
    await collectionsApi.previewEntryBranchTransfer('p1', 'c1', 'e1', { sourceBranch: 'dev', targetBranch: 'main' });
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/schemas/c1/entries/e1/branch-transfer/preview', {
      method: 'POST',
      body: { sourceBranch: 'dev', targetBranch: 'main' },
    });
  });

  it('applies branch transfer', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ committed: true, hash: 'h1', message: 'm', appliedPointerCount: 1 });
    const result = await collectionsApi.applyEntryBranchTransfer('p1', 'c1', 'e1', { sourceBranch: 'dev', targetBranch: 'main', resolutions: {} });
    expect(result.committed).toBe(true);
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/schemas/c1/entries/e1/branch-transfer/apply', {
      method: 'POST',
      body: { sourceBranch: 'dev', targetBranch: 'main', resolutions: {} },
    });
  });
});
