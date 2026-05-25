import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { User } from '@ori/shared';
import { apiServices } from '../lib/api-services';
import { internalError, unauthorized } from '../lib/responses';

const COOKIE_NAME_ACCESS = 'ori_access_token';
const COOKIE_NAME_REFRESH = 'ori_refresh_token';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export interface TokenPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh' | 'guest';
  id?: string;
}

// Lazy-load JWT_SECRET to ensure dotenv is configured first
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is required. ' +
      'Set a secure random string (min 32 characters) in your .env file.'
    );
  }
  return secret;
};

/**
 * Generate JWT tokens
 */
export function generateTokens(userId: string, email: string) {
  const secret = getJwtSecret();
  const accessToken = jwt.sign(
    { userId, email, type: 'access' } as TokenPayload,
    secret,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId, email, type: 'refresh' } as TokenPayload,
    secret,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

/**
 * Verify and decode a token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Generate a short-lived guest token for preview mode
 */
export function generateGuestToken(): string {
  const secret = getJwtSecret();
  return jwt.sign(
    { type: 'guest', id: `guest-${Date.now()}` } as TokenPayload,
    secret,
    { expiresIn: '1h' }
  );
}

function getCookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax' as const,
    maxAge: maxAgeMs,
  };
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
): void {
  res.cookie(COOKIE_NAME_ACCESS, accessToken, getCookieOptions(15 * 60 * 1000));
  res.cookie(COOKIE_NAME_REFRESH, refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(COOKIE_NAME_ACCESS, { httpOnly: true, secure: IS_PRODUCTION, sameSite: 'lax' });
  res.clearCookie(COOKIE_NAME_REFRESH, { httpOnly: true, secure: IS_PRODUCTION, sameSite: 'lax' });
}

function extractTokenFromRequest(req: Request): string | undefined {
  // Cookie takes precedence for browser clients
  const cookieToken = req.cookies?.[COOKIE_NAME_ACCESS];
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return undefined;
}

/**
 * Authentication middleware
 * Validates JWT and attaches user to request
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      unauthorized(res, 'Missing or invalid authorization header');
      return;
    }

    const payload = verifyToken(token);

    if (!payload || payload.type !== 'access') {
      unauthorized(res, 'Invalid or expired token', 'INVALID_TOKEN');
      return;
    }

    // Fetch user from database
    const user = await apiServices.prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        githubId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      unauthorized(res, 'User no longer exists', 'USER_NOT_FOUND');
      return;
    }

    req.user = user as unknown as User;
    req.userId = user.id;
    next();
  } catch (error) {
    apiServices.logger.error({ msg: 'Authentication error', error });
    internalError(res, 'Authentication error');
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      return next();
    }
    const payload = verifyToken(token);

    if (payload && payload.type === 'access') {
      const user = await apiServices.prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          githubId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (user) {
        req.user = user as unknown as User;
        req.userId = user.id;
      }
    }

    next();
  } catch {
    next();
  }
}
