import { describe, expect, it, vi } from 'vitest';
import {
  hashLockValue,
  normalizeBranch,
  retryAfterSeconds,
  sameLockHolder,
  toLockConflictDetails,
  toLockConflictInfo,
  toSharedLock,
  ttlForMode,
} from '../lock-support';
import type { ResourceLock as PrismaResourceLock } from '@prisma/client';

vi.mock('../../lib/api-services', () => ({
  apiServices: {
    now: () => new Date('2026-03-28T14:30:00.000Z'),
  },
}));

function createLock(overrides: Partial<PrismaResourceLock> = {}): PrismaResourceLock {
  return {
    id: 'lock-1',
    projectId: 'project-1',
    branch: 'main',
    resourceType: 'entry',
    resourceId: 'posts/hello-world',
    mode: 'hard',
    holderType: 'human',
    holderId: 'user-1',
    holderName: 'Test User',
    sessionId: 'session-1',
    reason: 'editing',
    acquiredAt: new Date('2026-03-28T14:29:30.000Z'),
    expiresAt: new Date('2026-03-28T14:30:15.000Z'),
    lockTokenHash: 'hashed-token',
    createdAt: new Date('2026-03-28T14:29:30.000Z'),
    updatedAt: new Date('2026-03-28T14:29:30.000Z'),
    ...overrides,
  };
}

describe('lock support', () => {
  it('normalizes branches and ttl values', () => {
    expect(normalizeBranch(' main ')).toBe('main');
    expect(normalizeBranch('   ')).toBeNull();
    expect(ttlForMode('hard')).toBe(45_000);
    expect(ttlForMode('soft')).toBe(30_000);
  });

  it('hashes lock tokens deterministically', () => {
    expect(hashLockValue('token')).toBe(hashLockValue('token'));
    expect(hashLockValue('token')).not.toBe(hashLockValue('other'));
  });

  it('maps prisma locks to shared response shapes', () => {
    const lock = createLock();

    expect(toSharedLock(lock)).toMatchObject({
      id: 'lock-1',
      projectId: 'project-1',
      branch: 'main',
      resourceType: 'entry',
      resourceId: 'posts/hello-world',
      mode: 'hard',
      holderType: 'human',
      holderId: 'user-1',
      holderName: 'Test User',
      sessionId: 'session-1',
      reason: 'editing',
    });

    expect(toLockConflictInfo(lock)).toEqual({
      required: true,
      mode: 'hard',
      heldByOther: true,
      holderType: 'human',
      holderName: 'Test User',
      expiresAt: '2026-03-28T14:30:15.000Z',
      retryAfterSeconds: 15,
    });

    expect(toLockConflictDetails(lock, {
      resourceType: 'entry',
      resourceId: 'posts/hello-world',
      branch: 'main',
    })).toEqual({
      resourceType: ['entry'],
      resourceId: ['posts/hello-world'],
      branch: ['main'],
      holderType: ['human'],
      holderName: ['Test User'],
      lockedAt: ['2026-03-28T14:29:30.000Z'],
      expiresAt: ['2026-03-28T14:30:15.000Z'],
      retryAfterSeconds: ['15'],
    });
  });

  it('computes retry windows and holder identity checks', () => {
    const lock = createLock();
    expect(retryAfterSeconds(lock)).toBe(15);
    expect(sameLockHolder(lock, { holderId: 'user-1', sessionId: 'session-1' })).toBe(true);
    expect(sameLockHolder(lock, { holderId: 'user-1', sessionId: 'session-2' })).toBe(false);
  });
});
