import { describe, it, expect, vi, beforeEach } from 'vitest';
import { projectsApi } from '../projects';
import * as core from '../core';

describe('projectsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists projects', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({
      projects: [{ id: 'p1', name: 'Test', slug: 'test', role: 'owner', defaultBranch: 'main' }],
    });

    const result = await projectsApi.list();
    expect(result.projects).toHaveLength(1);
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects');
  });

  it('gets a project', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({
      project: { id: 'p1', name: 'Test', slug: 'test', defaultBranch: 'main' },
    });

    const result = await projectsApi.get('p1');
    expect(result.project.id).toBe('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1');
  });

  it('creates a project', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({
      project: { id: 'p2', name: 'New', slug: 'new', defaultBranch: 'main' },
    });

    const result = await projectsApi.create({ name: 'New', slug: 'new' });
    expect(result.project.slug).toBe('new');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects', {
      method: 'POST',
      body: { name: 'New', slug: 'new' },
    });
  });

  it('updates a project', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({
      project: { id: 'p1', name: 'Updated', slug: 'test', defaultBranch: 'main' },
    });

    const result = await projectsApi.update('p1', { name: 'Updated' });
    expect(result.project.name).toBe('Updated');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1', {
      method: 'PATCH',
      body: { name: 'Updated' },
    });
  });
});
