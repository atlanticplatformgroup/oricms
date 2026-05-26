import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resourcesApi } from '../resources';
import * as core from '../core';

describe('resourcesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists resources', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ resources: [] });
    await resourcesApi.list('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/resources');
  });

  it('gets a resource', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ resource: { id: 'r1' } });
    const result = await resourcesApi.get('p1', 'r1');
    expect(result.resource.id).toBe('r1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/resources/r1');
  });

  it('lists records with pagination', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ records: [], pagination: { page: 1, limit: 10, total: 0, pageCount: 0 } });
    await resourcesApi.listRecords('p1', 'r1', { page: 2, limit: 20 });
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/resources/r1/records?page=2&limit=20');
  });

  it('lists records without options', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ records: [], pagination: { page: 1, limit: 10, total: 0, pageCount: 0 } });
    await resourcesApi.listRecords('p1', 'r1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/resources/r1/records?');
  });

  it('gets a record', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ record: { id: 'rec1' } });
    const result = await resourcesApi.getRecord('p1', 'r1', 'rec1');
    expect(result.record.id).toBe('rec1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/resources/r1/records/rec1');
  });

  it('gets schema', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ schema: { id: 's1' } });
    const result = await resourcesApi.getSchema('p1', 'r1');
    expect(result.schema.id).toBe('s1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/resources/r1/schema');
  });

  it('gets policy', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ policy: {}, capabilities: [] });
    await resourcesApi.getPolicy('p1', 'r1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/resources/r1/policy');
  });
});
