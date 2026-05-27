import { Router } from 'express';
import { logger } from '../middleware/logger';
import { internalError, ok } from '../lib/responses';
import { requirePermission } from '../permissions/middleware';
import { formatGitError } from './helpers';
import type { GitService } from './service';

export function createRepositoryRoutes(gitService: GitService): Router {
  const router = Router({ mergeParams: true });

  router.get('/status', requirePermission('collections', 'read'), async (req, res) => {
    try {
      const { projectId } = req.params;
      const status = await gitService.getStatus(projectId);
      ok(res, { status });
    } catch (error) {
      logger.error({ msg: 'Git status error', error });
      const { code, message } = formatGitError(error);
      internalError(res, message, code);
    }
  });

  router.post('/sync', requirePermission('collections', 'update'), async (req, res) => {
    try {
      const { projectId } = req.params;
      await gitService.sync(projectId);
      ok(res, { message: 'Repository synced successfully' });
    } catch (error) {
      logger.error({ msg: 'Repository sync error', error });
      const { code, message } = formatGitError(error);
      internalError(res, message, code);
    }
  });

  return router;
}
