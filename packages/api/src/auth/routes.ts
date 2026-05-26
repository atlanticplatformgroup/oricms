import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { z } from 'zod';
import { authenticate, optionalAuth } from './middleware';
import { logger } from '../middleware/logger';
import {
  internalError,
  ok,
} from '../lib/responses';
import {
  sendAuthValidationError,
} from './auth-route-common';
import {
  loginUserOrRespond,
  logoutUserOrRespond,
  refreshSessionOrRespond,
  registerUserOrRespond,
} from './credential-route-support';
import { authenticateGitHubOrRespond } from './github-route-support';
import { generateGuestToken } from './middleware';
import { getPrismaErrorResponse } from '../lib/prisma';
import {
  getCurrentUserPreferencesOrRespond,
  updateCurrentUserPreferencesOrRespond,
} from './preferences-route-support';

const router = Router();

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('password').isLength({ min: 8 }),
  ],
  async (req: Request, res: Response) => {
    try {
      if (sendAuthValidationError(res, req)) {
        return;
      }

      const { email, name, password } = req.body;
      await registerUserOrRespond(res, { email, name, password });
    } catch (error) {
      logger.error({ msg: 'Registration error', error });
      const prismaError = getPrismaErrorResponse(error);
      if (prismaError) {
        return res.status(prismaError.statusCode).json({ success: false, error: { code: prismaError.code, message: prismaError.message } });
      }
      internalError(res, 'Failed to create account');
    }
  }
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').exists(),
  ],
  async (req: Request, res: Response) => {
    try {
      if (sendAuthValidationError(res, req)) {
        return;
      }

      const { email, password } = req.body;
      await loginUserOrRespond(res, { email, password });
    } catch (error) {
      logger.error({ msg: 'Login error', error });
      const prismaError = getPrismaErrorResponse(error);
      if (prismaError) {
        return res.status(prismaError.statusCode).json({ success: false, error: { code: prismaError.code, message: prismaError.message } });
      }
      internalError(res, 'Login failed');
    }
  }
);

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const parseResult = refreshTokenSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0]?.message || 'Invalid refresh token',
          details: parseResult.error.errors,
        },
      });
    }
    const refreshToken = parseResult.data.refreshToken || req.cookies?.ori_refresh_token;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'refreshToken is required' } });
    }
    await refreshSessionOrRespond(res, refreshToken);
  } catch (error) {
    logger.error({ msg: 'Token refresh error', error });
    internalError(res, 'Failed to refresh token');
  }
});

router.post('/logout', optionalAuth, async (req: Request, res: Response) => {
  try {
    await logoutUserOrRespond(res, {
      refreshToken: req.body.refreshToken || req.cookies?.ori_refresh_token,
      userId: req.user?.id,
    });
  } catch (error) {
    logger.error({ msg: 'Logout error', error });
    internalError(res, 'Logout failed');
  }
});

router.get('/me', authenticate, async (req: Request, res: Response) => {
  ok(res, { user: req.user });
});

router.post('/github', async (req: Request, res: Response) => {
  try {
    await authenticateGitHubOrRespond(res, req.body.code);
  } catch (error) {
    logger.error({ msg: 'GitHub auth error', error });
    internalError(res, 'GitHub authentication failed');
  }
});

router.post('/guest-token', async (_req: Request, res: Response) => {
  try {
    const token = generateGuestToken();
    ok(res, { token });
  } catch (error) {
    logger.error({ msg: 'Guest token generation error', error });
    internalError(res, 'Failed to generate guest token');
  }
});

router.get('/me/preferences', authenticate, async (req: Request, res: Response) => {
  try {
    await getCurrentUserPreferencesOrRespond(res, req.userId);
  } catch (error) {
    logger.error({ msg: 'Get preferences error', error });
    internalError(res, 'Failed to get preferences');
  }
});

router.patch('/me/preferences', authenticate, async (req: Request, res: Response) => {
  try {
    await updateCurrentUserPreferencesOrRespond(res, {
      userId: req.userId,
      updates: req.body,
    });
  } catch (error) {
    logger.error({ msg: 'Update preferences error', error });
    internalError(res, 'Failed to update preferences');
  }
});

export default router;
