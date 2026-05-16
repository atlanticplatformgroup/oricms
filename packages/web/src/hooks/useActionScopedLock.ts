import { useState } from 'react';
import type { LockAcquireRequest, ResourceLock } from '@ori/shared';
import { ApiError } from '../lib/api/core';
import { locksApi } from '../lib/api/locks';

interface UseActionScopedLockOptions extends LockAcquireRequest {
  projectId: string | null;
}

export function useActionScopedLock(options: UseActionScopedLockOptions) {
  const { projectId, branch, mode, reason, resourceId, resourceType } = options;
  const [blockingLock, setBlockingLock] = useState<ResourceLock | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const clearFeedback = () => {
    setBlockingLock(null);
    setError(null);
  };

  const captureLockError = (caught: unknown) => {
    if (caught instanceof ApiError && caught.code === 'RESOURCE_LOCKED' && projectId) {
      const nextBlockingLock: ResourceLock = {
        id: 'blocking-lock',
        projectId,
        ...(branch ? { branch } : {}),
        resourceType,
        resourceId,
        mode,
        holderType: caught.details?.holderType?.[0] === 'agent' ? 'agent' : 'human',
        holderId: '',
        holderName: caught.details?.holderName?.[0] || 'Another editor',
        sessionId: '',
        reason,
        acquiredAt: caught.details?.lockedAt?.[0] || new Date().toISOString(),
        expiresAt: caught.details?.expiresAt?.[0] || new Date().toISOString(),
      };
      setBlockingLock(nextBlockingLock);
      setError(null);
      return;
    }

    setBlockingLock(null);
    setError(caught instanceof Error ? caught.message : 'Failed to acquire lock');
  };

  const runWithLock = async <T,>(action: (headers: Record<string, string>) => Promise<T>): Promise<T> => {
    if (!projectId) throw new Error('Project id is required');

    clearFeedback();
    setIsPending(true);

    let acquiredLock: { id: string } | null = null;
    let lockToken: string | undefined;

    try {
      const response = await locksApi.acquire(projectId, {
        branch,
        mode,
        reason,
        resourceId,
        resourceType,
      });
      acquiredLock = response.lock;
      lockToken = response.lockToken;

      const result = await action(locksApi.mutationHeaders(lockToken));
      clearFeedback();
      return result;
    } catch (caught) {
      captureLockError(caught);
      throw caught;
    } finally {
      if (acquiredLock) {
        void locksApi.release(projectId, acquiredLock.id, lockToken).catch(() => {
          // Best effort release after mutation.
        });
      }
      setIsPending(false);
    }
  };

  return {
    blockingLock,
    error,
    isPending,
    clearFeedback,
    runWithLock,
  };
}
