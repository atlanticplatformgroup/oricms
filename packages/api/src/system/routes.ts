import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../middleware/logger';
import { internalError, ok } from '../lib/responses';

const router = Router();

/**
 * GET /api/v1/system/status
 * Public endpoint to check if the CMS requires initial setup.
 */
router.get('/status', async (req, res) => {
  try {
    const [userCount, projectCount] = await Promise.all([
      prisma.user.count({ where: { type: 'HUMAN' } }),
      prisma.project.count(),
    ]);

    ok(res, {
      needsSetup: userCount === 0 || projectCount === 0,
      hasOwner: userCount > 0,
      hasProjects: projectCount > 0,
    });
  } catch (error) {
    logger.error({ msg: 'Failed to get system status', error });
    internalError(res, 'Could not determine system status');
  }
});

export default router;
