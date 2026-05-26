import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agentApi } from '../agent';
import * as core from '../core';

describe('agentApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gets status', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ enabled: true, role: 'owner', allowedBranches: ['main'], allowedCollections: [], historyDepth: 10, historyDays: 30, deploymentMode: 'cloud' });
    const result = await agentApi.getStatus('p1');
    expect(result.enabled).toBe(true);
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/agent/v1/admin/config?projectId=p1');
  });

  it('gets config', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ enabled: true, allowedBranches: ['main'], allowedCollections: [], historyDepth: 10, historyDays: 30, deploymentMode: 'cloud' });
    const result = await agentApi.getConfig('p1');
    expect(result.allowedBranches).toContain('main');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/agent/v1/admin/config?projectId=p1');
  });

  it('updates config', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce(undefined);
    await agentApi.updateConfig('p1', { enabled: false });
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/agent/v1/admin/config?projectId=p1', {
      method: 'PUT',
      body: { enabled: false },
    });
  });

  it('gets write configs', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ configs: [] });
    await agentApi.getWriteConfigs('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/agent/write-config');
  });

  it('updates write config', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce(undefined);
    await agentApi.updateWriteConfig('p1', 'posts', { collectionName: 'posts' });
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/agent/write-config/posts', {
      method: 'PUT',
      body: { collectionName: 'posts' },
    });
  });

  it('gets changes with default status', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ changes: [] });
    await agentApi.getChanges('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/agent/changes?status=PENDING');
  });

  it('promotes changes', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ promoted: 2 });
    const result = await agentApi.promoteChanges('p1', ['c1', 'c2'], 'main');
    expect(result.promoted).toBe(2);
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/agent/promote', {
      method: 'POST',
      body: { changeIds: ['c1', 'c2'], targetBranch: 'main' },
    });
  });

  it('lists tokens', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ tokens: [] });
    await agentApi.listTokens('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/agent/v1/admin/tokens?projectId=p1');
  });

  it('creates token', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ id: 't1', token: 'tok', name: 'My Token' });
    const result = await agentApi.createToken('p1', { userId: 'u1', name: 'My Token' });
    expect(result.token).toBe('tok');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/agent/v1/admin/tokens', {
      method: 'POST',
      body: { userId: 'u1', name: 'My Token', projectId: 'p1' },
    });
  });

  it('revokes token', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ message: 'Revoked' });
    const result = await agentApi.revokeToken('p1', 't1');
    expect(result.message).toBe('Revoked');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/agent/v1/admin/tokens/t1/revoke', {
      method: 'POST',
      body: { projectId: 'p1' },
    });
  });

  it('gets audit logs', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ logs: [], total: 0 });
    await agentApi.getAuditLogs('p1', { startDate: '2024-01-01', endDate: '2024-01-31', action: 'read', page: 1, limit: 20 });
    const url = requestSpy.mock.calls[0][0] as string;
    expect(url).toContain('projectId=p1');
    expect(url).toContain('startDate=2024-01-01');
    expect(url).toContain('endDate=2024-01-31');
    expect(url).toContain('action=read');
    expect(url).toContain('page=1');
    expect(url).toContain('limit=20');
  });

  it('getAuditLog delegates to getAuditLogs', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ logs: [], total: 0 });
    await agentApi.getAuditLog('p1');
    expect(requestSpy).toHaveBeenCalledWith(expect.stringContaining('/api/v1/agent/v1/admin/audit-log'));
  });

  it('gets audit summary', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ totalAccesses: 5, redactedAccesses: 0, uniqueFiles: 3, uniqueSessions: 2, piiPatternsFound: {} });
    const result = await agentApi.getAuditSummary('p1', { startDate: '2024-01-01' });
    expect(result.totalAccesses).toBe(5);
    expect(requestSpy).toHaveBeenCalledWith(expect.stringContaining('/api/v1/agent/v1/admin/audit-log/summary'));
  });
});
