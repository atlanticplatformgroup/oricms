import type { ResourceLock as PrismaResourceLock } from '@prisma/client';
import type { LockMode, LockResourceType } from '@ori/shared';
import { apiServices } from '../lib/api-services';
import {
  hashLockValue,
  normalizeBranch,
  sameLockHolder,
  ttlForMode,
} from './lock-support';

function now(): Date {
  return apiServices.now();
}

export async function deleteExpiredLocks(projectId?: string): Promise<void> {
  await apiServices.prisma.resourceLock.deleteMany({
    where: {
      expiresAt: { lte: now() },
      ...(projectId ? { projectId } : {}),
    },
  });
}

export async function findActiveLocks(params: {
  projectId: string;
  branch?: string | null;
  resourceType: LockResourceType;
  resourceId: string;
}): Promise<PrismaResourceLock[]> {
  await deleteExpiredLocks(params.projectId);
  return apiServices.prisma.resourceLock.findMany({
    where: {
      projectId: params.projectId,
      branch: normalizeBranch(params.branch),
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      expiresAt: { gt: now() },
    },
    orderBy: { acquiredAt: 'asc' },
  });
}

export async function findLockById(lockId: string): Promise<PrismaResourceLock | null> {
  return apiServices.prisma.resourceLock.findUnique({ where: { id: lockId } });
}

export async function createHardLock(input: {
  projectId: string;
  branch: string | null;
  resourceType: LockResourceType;
  resourceId: string;
  mode: LockMode;
  holderType: PrismaResourceLock['holderType'];
  holderId: string;
  holderName: string;
  sessionId: string;
  reason: PrismaResourceLock['reason'];
  expiresAt: Date;
  lockToken: string;
}): Promise<PrismaResourceLock> {
  return apiServices.prisma.resourceLock.create({
    data: {
      projectId: input.projectId,
      branch: input.branch,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      mode: input.mode,
      holderType: input.holderType,
      holderId: input.holderId,
      holderName: input.holderName,
      sessionId: input.sessionId,
      reason: input.reason,
      expiresAt: input.expiresAt,
      lockTokenHash: hashLockValue(input.lockToken),
    },
  });
}

export async function updateHardLock(input: {
  lock: PrismaResourceLock;
  holderType: PrismaResourceLock['holderType'];
  holderId: string;
  holderName: string;
  sessionId: string;
  reason: PrismaResourceLock['reason'];
  expiresAt: Date;
  lockToken: string;
}): Promise<PrismaResourceLock> {
  return apiServices.prisma.resourceLock.update({
    where: { id: input.lock.id },
    data: {
      holderType: input.holderType,
      holderId: input.holderId,
      holderName: input.holderName,
      sessionId: input.sessionId,
      reason: input.reason,
      expiresAt: input.expiresAt,
      lockTokenHash: hashLockValue(input.lockToken),
    },
  });
}

export async function createSoftLock(input: {
  projectId: string;
  branch: string | null;
  resourceType: LockResourceType;
  resourceId: string;
  mode: LockMode;
  holderType: PrismaResourceLock['holderType'];
  holderId: string;
  holderName: string;
  sessionId: string;
  reason: PrismaResourceLock['reason'];
  expiresAt: Date;
}): Promise<PrismaResourceLock> {
  return apiServices.prisma.resourceLock.create({
    data: {
      projectId: input.projectId,
      branch: input.branch,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      mode: input.mode,
      holderType: input.holderType,
      holderId: input.holderId,
      holderName: input.holderName,
      sessionId: input.sessionId,
      reason: input.reason,
      expiresAt: input.expiresAt,
    },
  });
}

export async function updateSoftLock(input: {
  lock: PrismaResourceLock;
  holderType: PrismaResourceLock['holderType'];
  holderName: string;
  reason: PrismaResourceLock['reason'];
  expiresAt: Date;
}): Promise<PrismaResourceLock> {
  return apiServices.prisma.resourceLock.update({
    where: { id: input.lock.id },
    data: {
      holderType: input.holderType,
      holderName: input.holderName,
      reason: input.reason,
      expiresAt: input.expiresAt,
    },
  });
}

export async function renewPersistedLock(input: {
  lock: PrismaResourceLock;
  nextToken?: string;
}): Promise<PrismaResourceLock> {
  return apiServices.prisma.resourceLock.update({
    where: { id: input.lock.id },
    data: {
      expiresAt: new Date(now().getTime() + ttlForMode(input.lock.mode as LockMode)),
      ...(input.nextToken ? { lockTokenHash: hashLockValue(input.nextToken) } : {}),
    },
  });
}

export async function deleteLock(lockId: string): Promise<void> {
  await apiServices.prisma.resourceLock.delete({ where: { id: lockId } });
}

export function findMatchingSoftLock(
  locks: PrismaResourceLock[],
  holder: { holderId: string; sessionId: string }
): PrismaResourceLock | undefined {
  return locks.find((lock) => lock.mode === 'soft' && sameLockHolder(lock, holder));
}
