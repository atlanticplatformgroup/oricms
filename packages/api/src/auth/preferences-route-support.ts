import { prisma } from '../lib/prisma';
import { notFound, ok, unauthorized } from '../lib/responses';
import { mergeUserPreferences, normalizeUserPreferences } from './route-support';

export async function getCurrentUserPreferencesOrRespond(
  res: Parameters<typeof ok>[0],
  userId: string | undefined,
) {
  if (!userId) {
    unauthorized(res, 'Not authenticated');
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  if (!user) {
    notFound(res, 'User not found', 'USER_NOT_FOUND');
    return;
  }

  ok(res, normalizeUserPreferences(user.preferences));
}

export async function updateCurrentUserPreferencesOrRespond(
  res: Parameters<typeof ok>[0],
  input: { updates: Record<string, unknown>; userId: string | undefined },
) {
  const { updates, userId } = input;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  if (!user) {
    notFound(res, 'User not found', 'USER_NOT_FOUND');
    return;
  }

  const mergedPreferences = mergeUserPreferences(user.preferences, updates);
  await prisma.user.update({
    where: { id: userId },
    data: { preferences: mergedPreferences },
  });

  ok(res, mergedPreferences);
}
