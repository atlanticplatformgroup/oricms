import bcrypt from 'bcrypt';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { conflict, created, ok, unauthorized } from '../lib/responses';
import { issueUserSession, resolveRefreshSession, revokeMatchingRefreshSession, rotateRefreshSession, toAuthUser } from './route-support';
import { verifyToken } from './middleware';

type RegisterUserRecord = Pick<Prisma.UserGetPayload<{
  select: {
    id: true;
    email: true;
    name: true;
    avatarUrl: true;
    createdAt: true;
    updatedAt: true;
  };
}>, 'id' | 'email' | 'name' | 'avatarUrl' | 'createdAt' | 'updatedAt'>;

export async function registerUserOrRespond(
  res: Parameters<typeof created>[0],
  input: { email: string; name: string; password: string },
) {
  const { email, name, password } = input;
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    conflict(res, 'An account with this email already exists', 'EMAIL_EXISTS');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user: RegisterUserRecord = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
    },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const { accessToken, refreshToken } = await issueUserSession(user);
  created(res, {
    user,
    accessToken,
    refreshToken,
  });
}

export async function loginUserOrRespond(
  res: Parameters<typeof ok>[0],
  input: { email: string; password: string },
) {
  const { email, password } = input;
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.password) {
    unauthorized(res, 'Invalid email or password', 'INVALID_CREDENTIALS');
    return;
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    unauthorized(res, 'Invalid email or password', 'INVALID_CREDENTIALS');
    return;
  }

  const { accessToken, refreshToken } = await issueUserSession(user);
  ok(res, {
    user: toAuthUser(user),
    accessToken,
    refreshToken,
  });
}

export async function refreshSessionOrRespond(
  res: Parameters<typeof ok>[0],
  refreshToken: string | undefined,
) {
  if (!refreshToken) {
    unauthorized(res, 'Refresh token required', 'MISSING_TOKEN');
    return;
  }

  const payload = verifyToken(refreshToken);
  if (!payload || payload.type !== 'refresh') {
    unauthorized(res, 'Invalid refresh token', 'INVALID_TOKEN');
    return;
  }

  const resolvedSession = await resolveRefreshSession(payload.userId, refreshToken);
  if (resolvedSession.kind !== 'valid') {
    unauthorized(res, 'Session expired or revoked', 'INVALID_TOKEN');
    return;
  }

  const tokens = await rotateRefreshSession(
    { id: payload.userId, email: payload.email },
    resolvedSession.session,
  );

  ok(res, tokens);
}

export async function logoutUserOrRespond(
  res: Parameters<typeof ok>[0],
  input: { refreshToken?: string; userId?: string },
) {
  const { refreshToken, userId } = input;
  if (refreshToken && userId) {
    await revokeMatchingRefreshSession(userId, refreshToken);
  }

  ok(res, { message: 'Logged out successfully' });
}
