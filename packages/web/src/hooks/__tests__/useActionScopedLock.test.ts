import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useActionScopedLock } from '../useActionScopedLock';
import { ApiError } from '../../lib/api/core';

const acquireMock = vi.fn();
const releaseMock = vi.fn();
const mutationHeadersMock = vi.fn().mockReturnValue({ 'x-lock-token': 'token-1' });

vi.mock('../../lib/api/locks', () => ({
  locksApi: {
    acquire: (...args: unknown[]) => acquireMock(...args),
    release: (...args: unknown[]) => releaseMock(...args),
    mutationHeaders: (...args: unknown[]) => mutationHeadersMock(...args),
  },
}));

describe('useActionScopedLock', () => {
  beforeEach(() => {
    acquireMock.mockReset();
    releaseMock.mockReset();
  });

  it('acquires lock and runs action', async () => {
    acquireMock.mockResolvedValue({ lock: { id: 'lock-1' }, lockToken: 'token-1' });
    releaseMock.mockResolvedValue({ released: true });

    const { result } = renderHook(() =>
      useActionScopedLock({
        projectId: 'proj-1',
        branch: 'main',
        mode: 'hard',
        reason: 'editing',
        resourceId: 'res-1',
        resourceType: 'entry',
      }),
    );

    const action = vi.fn().mockResolvedValue('done');

    await act(async () => {
      const promise = result.current.runWithLock(action);
      await expect(promise).resolves.toBe('done');
    });

    expect(acquireMock).toHaveBeenCalledWith('proj-1', {
      branch: 'main',
      mode: 'hard',
      reason: 'editing',
      resourceId: 'res-1',
      resourceType: 'entry',
    });
    expect(action).toHaveBeenCalledWith({ 'x-lock-token': 'token-1' });
    expect(releaseMock).toHaveBeenCalledWith('proj-1', 'lock-1', 'token-1');
  });

  it('sets blocking lock on RESOURCE_LOCKED error', async () => {
    const apiError = new ApiError('Locked', 'RESOURCE_LOCKED', 423);
    (apiError as unknown as { details: Record<string, string[]> }).details = {
      holderType: ['agent'],
      holderName: ['Alice'],
      lockedAt: ['2024-01-01T00:00:00Z'],
      expiresAt: ['2024-01-01T01:00:00Z'],
    };
    acquireMock.mockRejectedValue(apiError);

    const { result } = renderHook(() =>
      useActionScopedLock({
        projectId: 'proj-1',
        branch: 'main',
        mode: 'hard',
        reason: 'editing',
        resourceId: 'res-1',
        resourceType: 'entry',
      }),
    );

    await act(async () => {
      await expect(result.current.runWithLock(() => Promise.resolve())).rejects.toBeDefined();
    });

    expect(result.current.blockingLock).not.toBeNull();
    expect(result.current.blockingLock?.holderName).toBe('Alice');
    expect(result.current.blockingLock?.holderType).toBe('agent');
  });

  it('sets generic error on non-RESOURCE_LOCKED failure', async () => {
    acquireMock.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useActionScopedLock({
        projectId: 'proj-1',
        branch: 'main',
        mode: 'hard',
        reason: 'editing',
        resourceId: 'res-1',
        resourceType: 'entry',
      }),
    );

    await act(async () => {
      await expect(result.current.runWithLock(() => Promise.resolve())).rejects.toBeDefined();
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.blockingLock).toBeNull();
  });

  it('throws when projectId is null', async () => {
    const { result } = renderHook(() =>
      useActionScopedLock({
        projectId: null,
        branch: 'main',
        mode: 'hard',
        reason: 'editing',
        resourceId: 'res-1',
        resourceType: 'entry',
      }),
    );

    await act(async () => {
      await expect(result.current.runWithLock(() => Promise.resolve())).rejects.toThrow('Project id is required');
    });
  });

  it('clears feedback', async () => {
    acquireMock.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useActionScopedLock({
        projectId: 'proj-1',
        branch: 'main',
        mode: 'hard',
        reason: 'editing',
        resourceId: 'res-1',
        resourceType: 'entry',
      }),
    );

    await act(async () => {
      await expect(result.current.runWithLock(() => Promise.resolve())).rejects.toBeDefined();
    });

    expect(result.current.error).toBe('Network error');

    act(() => {
      result.current.clearFeedback();
    });

    expect(result.current.error).toBeNull();
  });

  it('tracks isPending during lock acquisition', async () => {
    let resolveAcquire: (value: { lock: { id: string }; lockToken: string }) => void;
    const acquirePromise = new Promise<{ lock: { id: string }; lockToken: string }>((resolve) => {
      resolveAcquire = resolve;
    });
    acquireMock.mockReturnValue(acquirePromise);
    releaseMock.mockResolvedValue({ released: true });

    const { result } = renderHook(() =>
      useActionScopedLock({
        projectId: 'proj-1',
        branch: 'main',
        mode: 'hard',
        reason: 'editing',
        resourceId: 'res-1',
        resourceType: 'entry',
      }),
    );

    const action = vi.fn().mockResolvedValue('done');

    act(() => {
      result.current.runWithLock(action);
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    await act(async () => {
      resolveAcquire!({ lock: { id: 'lock-1' }, lockToken: 'token-1' });
      await acquirePromise;
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });
});
