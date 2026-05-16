import { Router, type Request, type Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { encrypt } from '../lib/crypto';
import { logger } from '../middleware/logger';
import { ok } from '../lib/responses';
import { requireOwnerOrAdmin } from '../permissions/middleware';
import { sendInternalError, sendValidationError } from './shared';

const router = Router({ mergeParams: true });

router.post(
  '/:projectId/git-config',
  requireOwnerOrAdmin,
  [body('token').isString().notEmpty(), body('provider').optional().isIn(['github', 'gitlab', 'bitbucket'])],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res);
        return;
      }

      const { projectId } = req.params;
      const { token, provider = 'github' } = req.body;
      const encryptedToken = encrypt(token);

      const gitConfig = await prisma.projectGitConfig.upsert({
        where: { projectId },
        create: { projectId, encryptedToken, tokenProvider: provider },
        update: { encryptedToken, tokenProvider: provider },
      });

      ok(res, { message: 'Git credentials configured successfully', gitConfig: { id: gitConfig.id, tokenProvider: gitConfig.tokenProvider } });
    } catch (error) {
      logger.error({ msg: 'Configure git error', error });
      sendInternalError(res, 'Failed to configure Git credentials');
    }
  },
);

router.delete('/:projectId/git-config', requireOwnerOrAdmin, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    await prisma.projectGitConfig.delete({ where: { projectId } });
    ok(res, { message: 'Git credentials removed successfully' });
  } catch {
    ok(res, { message: 'Git credentials removed successfully' });
  }
});

export default router;
