import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
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
import {
  getCurrentUserPreferencesOrRespond,
  updateCurrentUserPreferencesOrRespond,
} from './preferences-route-support';

const router = Router();

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
      internalError(res, 'Login failed');
    }
  }
);

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    await refreshSessionOrRespond(res, req.body.refreshToken);
  } catch (error) {
    logger.error({ msg: 'Token refresh error', error });
    internalError(res, 'Failed to refresh token');
  }
});

router.post('/logout', optionalAuth, async (req: Request, res: Response) => {
  try {
    await logoutUserOrRespond(res, {
      refreshToken: req.body.refreshToken,
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
