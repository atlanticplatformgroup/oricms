import { prisma } from '../lib/prisma';
import { badRequest, ok } from '../lib/responses';
import { fetchGitHubProfile, issueUserSession, toAuthUser } from './route-support';
import { setAuthCookies } from './middleware';

export async function authenticateGitHubOrRespond(
  res: Parameters<typeof ok>[0],
  code: string | undefined,
) {
  if (!code) {
    badRequest(res, 'GitHub authorization code required', 'MISSING_CODE');
    return;
  }

  const githubProfile = await fetchGitHubProfile(code);
  if ('error' in githubProfile) {
    badRequest(res, githubProfile.error, 'GITHUB_AUTH_FAILED');
    return;
  }

  const { githubUser, primaryEmail } = githubProfile;
  if (!primaryEmail) {
    badRequest(res, 'GitHub account does not expose a primary email address', 'GITHUB_EMAIL_REQUIRED');
    return;
  }

  let user = await prisma.user.findUnique({
    where: { githubId: String(githubUser.id) },
  });

  if (!user) {
    const existingByEmail = await prisma.user.findUnique({
      where: { email: primaryEmail },
    });

    if (existingByEmail) {
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { githubId: String(githubUser.id) },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email: primaryEmail,
          name: githubUser.name || githubUser.login,
          avatarUrl: githubUser.avatar_url,
          githubId: String(githubUser.id),
        },
      });
    }
  }

  const { accessToken, refreshToken } = await issueUserSession(user);
  setAuthCookies(res, accessToken, refreshToken);
  ok(res, {
    user: toAuthUser(user),
    accessToken,
    refreshToken,
  });
}
