import { Router, type Request, type Response } from 'express';
import { query, validationResult } from 'express-validator';
import { requirePermission } from '../permissions/middleware';
import { logger } from '../middleware/logger';
import { internalError, notFound, ok } from '../lib/responses';
import { formatGitError, respondValidationError } from './helpers';
import type { GitService } from './service';

export function createHistoryRoutes(gitService: GitService): Router {
  const router = Router({ mergeParams: true });

  router.get('/', requirePermission('collections', 'read'), [query('path').optional().isString().trim().notEmpty()], async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { limit = 20, path } = req.query;
      const history = await gitService.getHistory(projectId, Math.min(parseInt(limit as string, 10), 100), typeof path === 'string' ? path : undefined);
      ok(res, { history });
    } catch (error) {
      logger.error({ msg: 'Get history error', error });
      const { code, message } = formatGitError(error);
      internalError(res, message, code);
    }
  });

  router.get(
    '/diff',
    requirePermission('collections', 'read'),
    [query('hash').isString().trim().notEmpty(), query('path').isString().trim().notEmpty()],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondValidationError(res, 'Invalid history diff query', errors.array());
          return;
        }
        const { projectId } = req.params;
        const hash = String(req.query.hash);
        const path = String(req.query.path);
        const diff = await gitService.getCommitDiff(projectId, hash, path);
        ok(res, { hash, path, diff });
      } catch (error) {
        logger.error({ msg: 'Get history diff error', error });
        const { code, message } = formatGitError(error);
        internalError(res, message, code);
      }
    }
  );

  router.get(
    '/file',
    requirePermission('collections', 'read'),
    [query('hash').isString().trim().notEmpty(), query('path').isString().trim().notEmpty()],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondValidationError(res, 'Invalid history file query', errors.array());
          return;
        }
        const { projectId } = req.params;
        const hash = String(req.query.hash);
        const path = String(req.query.path);
        const content = await gitService.getFileAtCommit(projectId, hash, path);
        if (content === null) {
          notFound(res, 'File not found in selected commit');
          return;
        }
        ok(res, { hash, path, content });
      } catch (error) {
        logger.error({ msg: 'Get history file error', error });
        const { code, message } = formatGitError(error);
        internalError(res, message, code);
      }
    }
  );

  return router;
}
