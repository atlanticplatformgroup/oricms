import crypto from 'crypto';
import type { ResourceLock as PrismaResourceLock } from '@prisma/client';
import type {
  LockConflictInfo,
  LockHolderType,
  LockMode,
  LockResourceType,
  ResourceLock,
} from '@ori/shared';
import type { ValidationErrorDetails } from '../lib/responses';
import { apiServices } from '../lib/api-services';

type LockReason = ResourceLock['reason'];

export type LockHolder = {
  holderType: LockHolderType;
  holderId: string;
  holderName: string;
  sessionId: string;
};

function now(): Date {
  return apiServices.now();
}

export function hashLockValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function issueLockToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function ttlForMode(mode: LockMode): number {
  return mode === 'hard' ? 45_000 : 30_000;
}

export function normalizeBranch(branch?: string | null): string | null {
  return typeof branch === 'string' && branch.trim() ? branch.trim() : null;
}

export function toSharedLock(lock: PrismaResourceLock): ResourceLock {
  return {
    id: lock.id,
    projectId: lock.projectId,
    ...(lock.branch ? { branch: lock.branch } : {}),
    resourceType: lock.resourceType as LockResourceType,
    resourceId: lock.resourceId,
    mode: lock.mode as LockMode,
    holderType: lock.holderType as LockHolderType,
    holderId: lock.holderId,
    holderName: lock.holderName,
    sessionId: lock.sessionId,
    reason: lock.reason as LockReason,
    acquiredAt: lock.acquiredAt.toISOString(),
    expiresAt: lock.expiresAt.toISOString(),
  };
}

export function retryAfterSeconds(lock: PrismaResourceLock): number {
  return Math.max(1, Math.ceil((lock.expiresAt.getTime() - now().getTime()) / 1000));
}

export function toLockConflictInfo(
  lock: PrismaResourceLock,
  mode: LockMode = 'hard'
): LockConflictInfo {
  return {
    required: true,
    mode,
    heldByOther: true,
    holderType: lock.holderType as LockHolderType,
    holderName: lock.holderName,
    expiresAt: lock.expiresAt.toISOString(),
    retryAfterSeconds: retryAfterSeconds(lock),
  };
}

export function toLockConflictDetails(
  lock: PrismaResourceLock,
  params: {
    resourceType: LockResourceType;
    resourceId: string;
    branch?: string | null;
  }
): ValidationErrorDetails {
  return {
    resourceType: [params.resourceType],
    resourceId: [params.resourceId],
    ...(params.branch ? { branch: [params.branch] } : {}),
    holderType: [lock.holderType],
    holderName: [lock.holderName],
    lockedAt: [lock.acquiredAt.toISOString()],
    expiresAt: [lock.expiresAt.toISOString()],
    retryAfterSeconds: [String(retryAfterSeconds(lock))],
  };
}

export function sameLockHolder(
  lock: PrismaResourceLock,
  holder: Pick<LockHolder, 'holderId' | 'sessionId'>
): boolean {
  return lock.holderId === holder.holderId && lock.sessionId === holder.sessionId;
}
