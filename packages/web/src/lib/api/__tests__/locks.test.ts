import { describe, it, expect, vi, beforeEach } from 'vitest';
import { locksApi, ORI_LOCK_TOKEN_HEADER, ORI_SESSION_ID_HEADER } from '../locks';
import * as core from '../core';
import * as session from '../../locks/session';

describe('locksApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(session, 'getLockSessionId').mockReturnValue('sess-123');
  });

  it('acquires a lock', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ lockId: 'l1', token: 'tok' });
    const result = await locksApi.acquire('p1', { resourceType: 'entry', resourceId: 'e1' });
    expect(result.lockId).toBe('l1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/locks/acquire', {
      method: 'POST',
      body: { resourceType: 'entry', resourceId: 'e1' },
      headers: { [ORI_SESSION_ID_HEADER]: 'sess-123' },
    });
  });

  it('renews a lock', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ lockId: 'l1', token: 'tok' });
    await locksApi.renew('p1', 'l1', 'tok');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/locks/renew', {
      method: 'POST',
      body: { lockId: 'l1' },
      headers: { [ORI_SESSION_ID_HEADER]: 'sess-123', [ORI_LOCK_TOKEN_HEADER]: 'tok' },
    });
  });

  it('releases a lock', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ released: true });
    const result = await locksApi.release('p1', 'l1', 'tok');
    expect(result.released).toBe(true);
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/locks/release', {
      method: 'POST',
      body: { lockId: 'l1' },
      headers: { [ORI_SESSION_ID_HEADER]: 'sess-123', [ORI_LOCK_TOKEN_HEADER]: 'tok' },
    });
  });

  it('checks lock status with branch', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ locked: false });
    await locksApi.status('p1', { resourceType: 'entry', resourceId: 'e1', branch: 'main' });
    expect(requestSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/projects/p1/locks/status'),
      { headers: { [ORI_SESSION_ID_HEADER]: 'sess-123' } },
    );
    const url = requestSpy.mock.calls[0][0] as string;
    expect(url).toContain('resourceType=entry');
    expect(url).toContain('resourceId=e1');
    expect(url).toContain('branch=main');
  });

  it('returns mutation headers', () => {
    const headers = locksApi.mutationHeaders('tok');
    expect(headers[ORI_LOCK_TOKEN_HEADER]).toBe('tok');
    expect(headers[ORI_SESSION_ID_HEADER]).toBe('sess-123');
  });
});
