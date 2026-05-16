import type { LockAcquireRequest, LockAcquireResponse, LockStatusResponse } from '@ori/shared';
import { request } from './core';
import { getLockSessionId } from '../locks/session';

export const ORI_LOCK_TOKEN_HEADER = 'x-ori-lock-token';
export const ORI_SESSION_ID_HEADER = 'x-ori-session-id';

function buildHeaders(lockToken?: string): Record<string, string> {
  return {
    [ORI_SESSION_ID_HEADER]: getLockSessionId(),
    ...(lockToken ? { [ORI_LOCK_TOKEN_HEADER]: lockToken } : {}),
  };
}

export const locksApi = {
  async acquire(projectId: string, payload: LockAcquireRequest): Promise<LockAcquireResponse> {
    return request(`/api/v1/projects/${projectId}/locks/acquire`, {
      method: 'POST',
      body: payload,
      headers: buildHeaders(),
    });
  },

  async renew(projectId: string, lockId: string, lockToken?: string): Promise<LockAcquireResponse> {
    return request(`/api/v1/projects/${projectId}/locks/renew`, {
      method: 'POST',
      body: { lockId },
      headers: buildHeaders(lockToken),
    });
  },

  async release(projectId: string, lockId: string, lockToken?: string): Promise<{ released: boolean }> {
    return request(`/api/v1/projects/${projectId}/locks/release`, {
      method: 'POST',
      body: { lockId },
      headers: buildHeaders(lockToken),
    });
  },

  async status(
    projectId: string,
    params: { resourceType: string; resourceId: string; branch?: string | null },
  ): Promise<LockStatusResponse> {
    const search = new URLSearchParams({
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      ...(params.branch ? { branch: params.branch } : {}),
    });
    return request(`/api/v1/projects/${projectId}/locks/status?${search.toString()}`, {
      headers: buildHeaders(),
    });
  },

  mutationHeaders(lockToken?: string): Record<string, string> {
    return buildHeaders(lockToken);
  },
};
