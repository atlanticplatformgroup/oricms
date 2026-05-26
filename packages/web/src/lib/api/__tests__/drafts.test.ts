import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveDraft, listDrafts, deleteDraft, getPreviewUrl, fetchDraftContent } from '../drafts';
import * as core from '../core';

describe('drafts api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves a draft', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ id: 'd1', previewToken: 'pt', updatedAt: '2024-01-01' });
    const result = await saveDraft('p1', { pageId: 'pg1', pagePath: '/about', content: {}, schemaIds: [] });
    expect(result.id).toBe('d1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/drafts', {
      method: 'POST',
      body: { pageId: 'pg1', pagePath: '/about', content: {}, schemaIds: [] },
    });
  });

  it('lists drafts', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce([{ id: 'd1' }]);
    const result = await listDrafts('p1');
    expect(result).toHaveLength(1);
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/drafts');
  });

  it('deletes a draft', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce(undefined);
    await deleteDraft('p1', 'pg1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/drafts/pg1', { method: 'DELETE' });
  });

  it('builds preview url with path', () => {
    const url = getPreviewUrl('https://example.com', 'token123', '/about');
    expect(url).toBe('https://example.com/?oricms_preview=token123&path=%2Fabout');
  });

  it('builds preview url without path', () => {
    const url = getPreviewUrl('https://example.com', 'token123');
    expect(url).toBe('https://example.com/?oricms_preview=token123');
  });

  it('fetches draft content', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ content: {}, pageId: 'pg1', pagePath: '/about', schemaIds: [], updatedAt: '2024-01-01' });
    const result = await fetchDraftContent('token123');
    expect(result.pageId).toBe('pg1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/preview/draft?token=token123', { requiresAuth: false });
  });
});
