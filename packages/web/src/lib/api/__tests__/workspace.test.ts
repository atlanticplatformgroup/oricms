import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workspaceApi } from '../workspace';
import * as core from '../core';

describe('workspaceApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists system surfaces', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ surfaces: [] });
    await workspaceApi.listSystemSurfaces('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/system-surfaces');
  });

  it('lists ui groups', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ uiGroups: [] });
    await workspaceApi.listUiGroups('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/ui-groups');
  });

  it('gets a ui group', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ uiGroup: { id: 'ug1' } });
    const result = await workspaceApi.getUiGroup('p1', 'ug1');
    expect(result.uiGroup.id).toBe('ug1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/ui-groups/ug1');
  });

  it('creates a ui group', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ uiGroup: { id: 'ug2' } });
    await workspaceApi.createUiGroup('p1', { name: 'Group', surfaceId: 's1' } as any);
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/ui-groups', {
      method: 'POST',
      body: { name: 'Group', surfaceId: 's1' },
    });
  });

  it('updates a ui group', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ uiGroup: { id: 'ug1' } });
    await workspaceApi.updateUiGroup('p1', 'ug1', { name: 'Updated' } as any);
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/ui-groups/ug1', {
      method: 'PATCH',
      body: { name: 'Updated' },
    });
  });

  it('deletes a ui group', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ deleted: true });
    const result = await workspaceApi.deleteUiGroup('p1', 'ug1');
    expect(result.deleted).toBe(true);
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/ui-groups/ug1', { method: 'DELETE' });
  });

  it('gets catalog', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ catalog: [] });
    await workspaceApi.getCatalog('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/workspace-catalog');
  });

  it('getWorkspaceCatalog aliases getCatalog', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ catalog: [] });
    await workspaceApi.getWorkspaceCatalog('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/workspace-catalog');
  });
});
