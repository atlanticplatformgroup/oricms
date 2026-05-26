import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildsApi } from '../builds';
import * as core from '../core';

describe('buildsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists builds with query params', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({
      builds: [{ id: 'b1', status: 'success' }],
      pagination: { total: 1, limit: 10, offset: 0 },
    });

    const result = await buildsApi.list('proj-1', { status: 'success', limit: 10, offset: 0 });
    expect(result.builds).toHaveLength(1);
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/proj-1/builds?status=success&limit=10');
  });

  it('gets build summary', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({
      latestBuild: { id: 'b1', status: 'success' },
      counts: { success: 5, failed: 1, pending: 0 },
    });

    const result = await buildsApi.getSummary('proj-1');
    expect(result.latestBuild?.id).toBe('b1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/proj-1/builds/status/summary');
  });

  it('triggers a build', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({
      build: { id: 'b2', status: 'pending' },
      message: 'Build triggered',
    });

    const result = await buildsApi.trigger('proj-1', 'main', 'abc123');
    expect(result.build.id).toBe('b2');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/proj-1/builds', {
      method: 'POST',
      body: { branch: 'main', commit: 'abc123' },
    });
  });

  it('cancels a build', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({
      build: { id: 'b1', status: 'cancelled' },
      message: 'Build cancelled',
    });

    const result = await buildsApi.cancel('proj-1', 'b1');
    expect(result.build.status).toBe('cancelled');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/proj-1/builds/b1/cancel', {
      method: 'POST',
    });
  });
});
