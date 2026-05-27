import bcrypt from 'bcrypt';
import crypto from 'crypto';
import type { Prisma, Session, User } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { generateTokens } from './middleware';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export interface GitHubUserResponse {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface GitHubEmailResponse {
  email: string;
  primary: boolean;
}

type AuthUser = Pick<User, 'id' | 'email' | 'name' | 'avatarUrl' | 'createdAt' | 'updatedAt'>;

type GitHubProfile = {
  githubUser: GitHubUserResponse;
  primaryEmail: string | null;
};

type RefreshResolution =
  | { kind: 'valid'; session: Session }
  | { kind: 'invalid' };

function getSessionExpiryDate(): Date {
  return new Date(Date.now() + SESSION_TTL_MS);
}

function extractPreferencesRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function hashRefreshToken(token: string): Promise<string> {
  const sha256Hash = crypto.createHash('sha256').update(token).digest('hex');
  return bcrypt.hash(sha256Hash, 10);
}

async function compareRefreshToken(token: string, hash: string): Promise<boolean> {
  const sha256Hash = crypto.createHash('sha256').update(token).digest('hex');
  return bcrypt.compare(sha256Hash, hash);
}

export function toAuthUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function issueUserSession(user: Pick<User, 'id' | 'email'>, familyId = crypto.randomUUID()) {
  const { accessToken, refreshToken } = generateTokens(user.id, user.email);
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: await hashRefreshToken(refreshToken),
      family: familyId,
      expiresAt: getSessionExpiryDate(),
    },
  });

  return {
    accessToken,
    refreshToken,
    familyId,
  };
}

async function revokeSessionFamily(userId: string, family: string, reason: string): Promise<void> {
  await prisma.session.updateMany({
    where: {
      userId,
      family,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      revokedReason: reason,
    },
  });
}

export async function resolveRefreshSession(userId: string, refreshToken: string): Promise<RefreshResolution> {
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      expiresAt: { gt: new Date() },
      revokedAt: null,
    },
  });

  for (const session of sessions) {
    if (await compareRefreshToken(refreshToken, session.tokenHash)) {
      if (session.rotatedAt) {
        if (session.family) {
          await revokeSessionFamily(userId, session.family, 'TOKEN_REPLAY_DETECTED');
        }
        return { kind: 'invalid' };
      }
      return { kind: 'valid', session };
    }
  }

  const allUserSessions = await prisma.session.findMany({
    where: { userId },
  });

  for (const session of allUserSessions) {
    if (await compareRefreshToken(refreshToken, session.tokenHash)) {
      if ((session.rotatedAt || session.revokedAt) && session.family) {
        await revokeSessionFamily(userId, session.family, 'TOKEN_REPLAY_DETECTED');
      }
      return { kind: 'invalid' };
    }
  }

  return { kind: 'invalid' };
}

export async function rotateRefreshSession(user: Pick<User, 'id' | 'email'>, currentSession: Session) {
  const tokens = generateTokens(user.id, user.email);

  await prisma.session.update({
    where: { id: currentSession.id },
    data: {
      rotatedAt: new Date(),
    },
  });

  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: await hashRefreshToken(tokens.refreshToken),
      family: currentSession.family,
      parentHash: currentSession.tokenHash,
      expiresAt: getSessionExpiryDate(),
    },
  });

  return tokens;
}

export async function revokeMatchingRefreshSession(userId: string, refreshToken: string): Promise<void> {
  const sessions = await prisma.session.findMany({
    where: { userId },
  });

  for (const session of sessions) {
    if (await compareRefreshToken(refreshToken, session.tokenHash)) {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
          revokedReason: 'USER_LOGOUT',
        },
      });
      return;
    }
  }
}

export async function fetchGitHubProfile(code: string): Promise<GitHubProfile | { error: string }> {
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenResponse.json() as GitHubTokenResponse;
  if (tokenData.error || !tokenData.access_token) {
    return { error: tokenData.error_description || 'GitHub authentication failed' };
  }

  const githubToken = tokenData.access_token;
  const [userResponse, emailsResponse] = await Promise.all([
    fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }),
    fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }),
  ]);

  const githubUser = await userResponse.json() as GitHubUserResponse;
  const emails = await emailsResponse.json() as GitHubEmailResponse[];

  return {
    githubUser,
    primaryEmail: emails.find((email) => email.primary)?.email || githubUser.email,
  };
}

export function normalizeUserPreferences(value: unknown): Prisma.InputJsonValue {
  const preferences = extractPreferencesRecord(value);
  const onboarding = extractPreferencesRecord(preferences.onboarding);

  return {
    theme: preferences.theme || 'system',
    editorMode: preferences.editorMode || 'split',
    notifications: preferences.notifications || { builds: true, invites: true, mentions: true },
    lastViprojectdProjectId: preferences.lastViprojectdProjectId || null,
    projectDefaults: extractPreferencesRecord(preferences.projectDefaults),
    onboarding: Object.keys(onboarding).length > 0
      ? onboarding
      : {
          version: 2,
          lastStep: 'welcome',
          completedAt: null,
          createdProjectId: null,
        },
  } as Prisma.InputJsonValue;
}

export function mergeUserPreferences(current: unknown, updates: Record<string, unknown>): Prisma.InputJsonValue {
  const currentPreferences = extractPreferencesRecord(current);
  const currentProjectDefaults = extractPreferencesRecord(currentPreferences.projectDefaults);

  return {
    ...currentPreferences,
    ...updates,
    projectDefaults: updates.projectDefaults
      ? { ...currentProjectDefaults, ...(updates.projectDefaults as Record<string, unknown>) }
      : currentProjectDefaults,
  } as Prisma.InputJsonValue;
}
