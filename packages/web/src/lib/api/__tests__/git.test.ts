import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gitApi } from '../git';
import * as core from '../core';

describe('gitApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gets status', async () => {
    const _requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ status: { ahead: 0, behind: 0, modified: [], staged: [] } });
    await gitApi.getStatus('p1');
    expect(_requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/git/status');
  });

  it('gets branches with fallback current', async () => {
    vi.spyOn(core, 'request').mockResolvedValueOnce({
      branches: [{ name: 'main', isCurrent: true }],
      current: null,
    });
    const result = await gitApi.getBranches('p1');
    expect(result.current).toBe('main');
  });

  it('compares branches', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ base: 'main', head: 'dev', ahead: 2, behind: 1 });
    const result = await gitApi.compareBranches('p1', 'main', 'dev');
    expect(result.ahead).toBe(2);
    expect(requestSpy).toHaveBeenCalledWith(expect.stringContaining('/api/v1/projects/p1/git/branches/compare'));
  });

  it('creates a branch', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ branches: [], current: null });
    await gitApi.createBranch('p1', 'feat', 'main', { 'x-lock': 'tok' });
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/git/branches', {
      method: 'POST',
      body: { name: 'feat', fromBranch: 'main' },
      headers: { 'x-lock': 'tok' },
    });
  });

  it('renames a branch', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ branch: { name: 'new-name' }, updatedMappings: 3 });
    const result = await gitApi.renameBranch('p1', 'old', 'new-name');
    expect(result.branch.name).toBe('new-name');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/git/branches/old', {
      method: 'PATCH',
      body: { newName: 'new-name' },
      headers: undefined,
    });
  });

  it('deletes a branch', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ deleted: true, removedMappings: 2 });
    const result = await gitApi.deleteBranch('p1', 'feat');
    expect(result.deleted).toBe(true);
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/git/branches/feat', {
      method: 'DELETE',
      headers: undefined,
    });
  });

  it('switches branch', async () => {
    vi.spyOn(core, 'request').mockResolvedValueOnce({ branches: [], current: 'dev' });
    const result = await gitApi.switchBranch('p1', 'dev');
    expect(result.current).toBe('dev');
  });

  it('checkoutBranch delegates to switchBranch', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ branches: [], current: 'dev' });
    const result = await gitApi.checkoutBranch('p1', 'dev');
    expect(result.branch).toBe('dev');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/git/branches/switch', {
      method: 'POST',
      body: { name: 'dev' },
    });
  });

  it('promotes a branch', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({
      sourceBranch: 'dev', targetBranch: 'main', approvalId: 'a1', mergeCommit: { hash: 'h1', message: 'm' }, comparison: { ahead: 1, behind: 0 },
    });
    const result = await gitApi.promoteBranch('p1', 'dev', 'main', 'a1', 'msg');
    expect(result.mergeCommit.hash).toBe('h1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/git/promote', {
      method: 'POST',
      body: { sourceBranch: 'dev', targetBranch: 'main', approvalId: 'a1', message: 'msg' },
      headers: undefined,
    });
  });

  it('lists promotion requests with filters', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ requests: [] });
    await gitApi.listPromotionRequests('p1', { sourceBranch: 'dev', targetBranch: 'main', status: 'pending', limit: 10 });
    const url = requestSpy.mock.calls[0][0] as string;
    expect(url).toContain('sourceBranch=dev');
    expect(url).toContain('targetBranch=main');
    expect(url).toContain('status=pending');
    expect(url).toContain('limit=10');
  });

  it('requests promotion approval', async () => {
    vi.spyOn(core, 'request').mockResolvedValueOnce({ request: { id: 'r1', sourceBranch: 'dev', targetBranch: 'main', status: 'pending' } });
    const result = await gitApi.requestPromotionApproval('p1', 'dev', 'main', 'reason');
    expect(result.request?.id).toBe('r1');
  });

  it('approves promotion request', async () => {
    vi.spyOn(core, 'request').mockResolvedValueOnce({ request: { id: 'r1', status: 'approved' } });
    const result = await gitApi.approvePromotionRequest('p1', 'r1');
    expect(result.request?.status).toBe('approved');
  });

  it('rejects promotion request', async () => {
    vi.spyOn(core, 'request').mockResolvedValueOnce({ request: { id: 'r1', status: 'rejected' } });
    const result = await gitApi.rejectPromotionRequest('p1', 'r1', 'no');
    expect(result.request?.status).toBe('rejected');
  });

  it('gets commits', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ commits: [] });
    await gitApi.getCommits('p1', 'main', 20);
    const url = requestSpy.mock.calls[0][0] as string;
    expect(url).toContain('branch=main');
    expect(url).toContain('limit=20');
  });

  it('pulls', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce(undefined);
    await gitApi.pull('p1', 'main');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/git/pull', {
      method: 'POST',
      body: { branch: 'main' },
    });
  });

  it('pushes', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce(undefined);
    await gitApi.push('p1', 'main');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/git/push', {
      method: 'POST',
      body: { branch: 'main' },
    });
  });

  it('gets schemas', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ schemas: [] });
    await gitApi.getSchemas('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/git/schemas');
  });

  it('saves schema', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce(undefined);
    await gitApi.saveSchema('p1', 'types/post.json', '{}', 'update');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/git/schemas/types%2Fpost.json', {
      method: 'POST',
      body: { content: '{}', message: 'update' },
      headers: undefined,
    });
  });

  it('deletes schema', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce(undefined);
    await gitApi.deleteSchema('p1', 'types/old.json');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/git/schemas/types%2Fold.json', {
      method: 'DELETE',
      headers: undefined,
    });
  });
});
