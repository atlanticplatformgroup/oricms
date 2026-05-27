import { Router, type Request, type Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { requirePermission } from '../permissions/middleware';
import { logger } from '../middleware/logger';
import { conflict, internalError, notFound, ok } from '../lib/responses';
import { formatGitError, respondValidationError } from './helpers';
import type { GitService } from './service';
import {
  createBranchAndList,
  deleteBranchAndMappings,
  ensureBranchSettingsUnlocked,
  formatBranchMutationError,
  getBranchListResponse,
  normalizeBranchNameParam,
  renameBranchAndMappings,
  switchBranchAndList,
} from './branch-route-support';

export function createBranchRoutes(gitService: GitService): Router {
  const router = Router({ mergeParams: true });

  router.get(
    '/',
    requirePermission('collections', 'read'),
    [
      query('page').optional().isInt({ min: 1 }).toInt(),
      query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondValidationError(res, 'Invalid branch list parameters', errors.array());
          return;
        }

        const { projectId } = req.params;
        const page = typeof req.query.page === 'number' ? req.query.page : 1;
        const limit = typeof req.query.limit === 'number' ? req.query.limit : 50;
        ok(res, await getBranchListResponse(gitService, projectId, { page, limit }));
      } catch (error) {
        logger.error({ msg: 'List branches error', error });
        const { code, message } = formatGitError(error);
        internalError(res, message, code);
      }
    }
  );

  router.get(
    '/compare',
    requirePermission('collections', 'read'),
    [query('base').isString().trim().notEmpty(), query('head').isString().trim().notEmpty()],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondValidationError(res, 'Invalid branch comparison parameters', errors.array());
          return;
        }

        const { projectId } = req.params;
        const base = String(req.query.base);
        const head = String(req.query.head);
        const comparison = await gitService.compareBranches(projectId, base, head);
        ok(res, { base, head, ...comparison });
      } catch (error) {
        logger.error({ msg: 'Compare branches error', error });
        const { code, message } = formatGitError(error);
        internalError(res, message, code);
      }
    }
  );

  router.get(
    '/diff-summary',
    requirePermission('collections', 'read'),
    [
      query('base').isString().trim().notEmpty(),
      query('head').isString().trim().notEmpty(),
      query('limit').optional().isInt({ min: 1, max: 1000 }),
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondValidationError(res, 'Invalid branch diff summary parameters', errors.array());
          return;
        }

        const { projectId } = req.params;
        const base = String(req.query.base);
        const head = String(req.query.head);
        const limit = Math.min(req.query.limit ? Number.parseInt(String(req.query.limit), 10) : 200, 100);
        const summary = await gitService.getBranchDiffSummary(projectId, base, head, limit);
        ok(res, { base, head, ...summary });
      } catch (error) {
        logger.error({ msg: 'Branch diff summary error', error });
        const { code, message } = formatGitError(error);
        internalError(res, message, code);
      }
    }
  );

  router.post(
    '/',
    requirePermission('collections', 'update'),
    [
      body('name').isString().trim().notEmpty(),
      body('from').optional().isString().trim().notEmpty(),
      body('fromBranch').optional().isString().trim().notEmpty(),
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondValidationError(res, 'Invalid branch create payload', errors.array());
          return;
        }

        const { projectId } = req.params;
        if (!(await ensureBranchSettingsUnlocked(req, res, projectId))) {
          return;
        }
        const { name, from, fromBranch } = req.body as { name: string; from?: string; fromBranch?: string };
        ok(res, await createBranchAndList(gitService, projectId, name, fromBranch || from));
      } catch (error) {
        logger.error({ msg: 'Create branch error', error });
        const known = formatBranchMutationError(error);
        if (known) {
          if (known.status === 404) {
            notFound(res, known.message, known.code);
            return;
          }
          if (known.status === 409) {
            conflict(res, known.message, known.code);
            return;
          }
          res.status(known.status).json({ success: false, error: { code: known.code, message: known.message } });
          return;
        }
        const { code, message: fallbackMessage } = formatGitError(error);
        internalError(res, fallbackMessage, code);
      }
    }
  );

  router.post(
    '/switch',
    requirePermission('collections', 'update'),
    [body('name').isString().trim().notEmpty()],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondValidationError(res, 'Invalid branch switch payload', errors.array());
          return;
        }

        const { projectId } = req.params;
        const { name } = req.body as { name: string };
        ok(res, await switchBranchAndList(gitService, projectId, name));
      } catch (error) {
        logger.error({ msg: 'Switch branch error', error });
        const message = error instanceof Error ? error.message : '';
        if (/not found/i.test(message)) {
          notFound(res, message, 'BRANCH_NOT_FOUND');
          return;
        }
        const { code, message: fallbackMessage } = formatGitError(error);
        internalError(res, fallbackMessage, code);
      }
    }
  );

  router.patch(
    '/:branchName(*)',
    requirePermission('collections', 'update'),
    [param('branchName').isString().trim().notEmpty(), body('newName').isString().trim().notEmpty()],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondValidationError(res, 'Invalid branch rename payload', errors.array());
          return;
        }

        const { projectId } = req.params;
        if (!(await ensureBranchSettingsUnlocked(req, res, projectId))) {
          return;
        }
        const branchName = normalizeBranchNameParam(req.params.branchName);
        const { newName } = req.body as { newName: string };
        ok(res, await renameBranchAndMappings(gitService, projectId, branchName, newName));
      } catch (error) {
        logger.error({ msg: 'Rename branch error', error });
        const known = formatBranchMutationError(error);
        if (known) {
          if (known.status === 404) {
            notFound(res, known.message, known.code);
            return;
          }
          if (known.status === 409) {
            conflict(res, known.message, known.code);
            return;
          }
          res.status(known.status).json({ success: false, error: { code: known.code, message: known.message } });
          return;
        }
        const { code, message } = formatGitError(error);
        internalError(res, message, code);
      }
    }
  );

  router.delete(
    '/:branchName(*)',
    requirePermission('collections', 'update'),
    [param('branchName').isString().trim().notEmpty()],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondValidationError(res, 'Invalid branch delete parameters', errors.array());
          return;
        }

        const { projectId } = req.params;
        if (!(await ensureBranchSettingsUnlocked(req, res, projectId))) {
          return;
        }
        const branchName = normalizeBranchNameParam(req.params.branchName);
        ok(res, await deleteBranchAndMappings(gitService, projectId, branchName));
      } catch (error) {
        logger.error({ msg: 'Delete branch error', error });
        const known = formatBranchMutationError(error);
        if (known) {
          if (known.status === 404) {
            notFound(res, known.message, known.code);
            return;
          }
          if (known.status === 409) {
            conflict(res, known.message, known.code);
            return;
          }
          res.status(known.status).json({ success: false, error: { code: known.code, message: known.message } });
          return;
        }
        const { code, message } = formatGitError(error);
        internalError(res, message, code);
      }
    }
  );

  return router;
}
