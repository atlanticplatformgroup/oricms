import type { ResourceLock as PrismaResourceLock } from '@prisma/client';
import type {
  LockAcquireRequest,
  LockAcquireResponse,
  LockResourceType,
  ResourceLock,
} from '@ori/shared';
import { apiServices } from '../lib/api-services';
import {
  createHardLock,
  createSoftLock,
  deleteExpiredLocks,
  deleteLock,
  findActiveLocks,
  findLockById,
  findMatchingSoftLock,
  renewPersistedLock,
  updateHardLock,
  updateSoftLock,
} from './lock-store';
import {
  hashLockValue,
  issueLockToken,
  normalizeBranch,
  sameLockHolder,
  toLockConflictDetails,
  toLockConflictInfo,
  toSharedLock,
  ttlForMode,
  type LockHolder,
} from './lock-support';

export const ORI_LOCK_TOKEN_HEADER = 'x-ori-lock-token';
export const ORI_SESSION_ID_HEADER = 'x-ori-session-id';
export const HARD_LOCK_TTL_MS = 45_000;
export const SOFT_LOCK_TTL_MS = 30_000;
export const LOCK_HEARTBEAT_MS = 15_000;
export {
  toLockConflictDetails,
  toLockConflictInfo,
};
export type { LockHolder } from './lock-support';

export class LockConflictError extends Error {
  constructor(
    public readonly lock: PrismaResourceLock,
    public readonly resourceType: LockResourceType,
    public readonly resourceId: string,
    public readonly branch?: string | null,
  ) {
    super('Resource is locked');
    this.name = 'LockConflictError';
  }
}

export class LockTokenError extends Error {
  constructor(message = 'Lock token is invalid') {
    super(message);
    this.name = 'LockTokenError';
  }
}

export async function acquireResourceLock(
  projectId: string,
  request: LockAcquireRequest,
  holder: LockHolder,
): Promise<LockAcquireResponse> {
  const branch = normalizeBranch(request.branch);
  const activeLocks = await findActiveLocks({
    projectId,
    branch,
    resourceType: request.resourceType,
    resourceId: request.resourceId,
  });

  const expiresAt = new Date(apiServices.now().getTime() + ttlForMode(request.mode));
  if (request.mode === 'hard') {
    const activeHardLock = activeLocks.find((lock) => lock.mode === 'hard');
    const nextToken = issueLockToken();

    if (activeHardLock && !sameLockHolder(activeHardLock, holder)) {
      throw new LockConflictError(activeHardLock, request.resourceType, request.resourceId, branch);
    }

    const lock = activeHardLock
      ? await updateHardLock({
          lock: activeHardLock,
          holderType: holder.holderType,
          holderId: holder.holderId,
          holderName: holder.holderName,
          sessionId: holder.sessionId,
          reason: request.reason,
          expiresAt,
          lockToken: nextToken,
        })
      : await createHardLock({
          projectId,
          branch,
          resourceType: request.resourceType,
          resourceId: request.resourceId,
          mode: request.mode,
          holderType: holder.holderType,
          holderId: holder.holderId,
          holderName: holder.holderName,
          sessionId: holder.sessionId,
          reason: request.reason,
          expiresAt,
          lockToken: nextToken,
        });

    return {
      lock: toSharedLock(lock),
      lockToken: nextToken,
    };
  }

  const softLock = findMatchingSoftLock(activeLocks, holder);
  const lock = softLock
    ? await updateSoftLock({
        lock: softLock,
        holderType: holder.holderType,
        holderName: holder.holderName,
        reason: request.reason,
        expiresAt,
      })
    : await createSoftLock({
        projectId,
        branch,
        resourceType: request.resourceType,
        resourceId: request.resourceId,
        mode: request.mode,
        holderType: holder.holderType,
        holderId: holder.holderId,
        holderName: holder.holderName,
        sessionId: holder.sessionId,
        reason: request.reason,
        expiresAt,
      });

  return { lock: toSharedLock(lock) };
}

export async function getResourceLocks(params: {
  projectId: string;
  branch?: string | null;
  resourceType: LockResourceType;
  resourceId: string;
}): Promise<ResourceLock[]> {
  const locks = await findActiveLocks(params);
  return locks.map(toSharedLock);
}

export async function renewResourceLock(params: {
  lockId: string;
  holderId: string;
  sessionId: string;
  lockToken?: string;
}): Promise<LockAcquireResponse> {
  await deleteExpiredLocks();
  const lock = await findLockById(params.lockId);
  if (!lock) {
    throw new LockTokenError('Lock not found or has expired');
  }
  if (!sameLockHolder(lock, params)) {
    throw new LockTokenError('This lock belongs to another session');
  }
  let nextToken: string | undefined;
  if (lock.mode === 'hard') {
    if (!params.lockToken || hashLockValue(params.lockToken) !== lock.lockTokenHash) {
      throw new LockTokenError();
    }
    nextToken = issueLockToken();
  }

  const updated = await renewPersistedLock({ lock, nextToken });

  return {
    lock: toSharedLock(updated),
    ...(nextToken ? { lockToken: nextToken } : {}),
  };
}

export async function releaseResourceLock(params: {
  lockId: string;
  holderId: string;
  sessionId: string;
  lockToken?: string;
}): Promise<void> {
  const lock = await findLockById(params.lockId);
  if (!lock) {
    return;
  }
  if (!sameLockHolder(lock, params)) {
    throw new LockTokenError('This lock belongs to another session');
  }
  if (lock.mode === 'hard' && (!params.lockToken || hashLockValue(params.lockToken) !== lock.lockTokenHash)) {
    throw new LockTokenError();
  }
  await deleteLock(lock.id);
}

export async function getConflictingHardLock(params: {
  projectId: string;
  branch?: string | null;
  resourceType: LockResourceType;
  resourceId: string;
  holderId?: string;
  sessionId?: string;
}): Promise<PrismaResourceLock | null> {
  const activeLocks = await findActiveLocks(params);
  const activeHardLock = activeLocks.find((lock) => lock.mode === 'hard');
  if (!activeHardLock) {
    return null;
  }
  if (params.holderId && activeHardLock.holderId === params.holderId) {
    if (!params.sessionId || activeHardLock.sessionId === params.sessionId) {
      return null;
    }
  }
  return activeHardLock;
}

export async function assertHardLockAvailable(params: {
  projectId: string;
  branch?: string | null;
  resourceType: LockResourceType;
  resourceId: string;
  holderId?: string;
  sessionId?: string;
}): Promise<{ ok: true } | { ok: false; lock: PrismaResourceLock }> {
  const conflict = await getConflictingHardLock(params);
  if (conflict) {
    return { ok: false, lock: conflict };
  }
  return { ok: true };
}
