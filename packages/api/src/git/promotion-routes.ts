import { Router, type Request, type Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { requirePermission } from '../permissions/middleware';
import { logger } from '../middleware/logger';
import { internalError, ok, unauthorized } from '../lib/responses';
import { formatGitError, respondValidationError } from './helpers';
import {
  type PromotionResolution,
} from './promotion-route-support';
import type { GitService } from './service';
import {
  approvePromotionRequestOrRespond,
  createPromotionRequestOrRespond,
  getPromotionConflictFile,
  listPromotionRequestsForQuery,
  promoteBranchesOrRespond,
  rejectPromotionRequestOrRespond,
  resolvePromotionConflictsOrRespond,
} from './promotion-route-actions';

export function createPromotionRoutes(gitService: GitService): Router {
  const router = Router({ mergeParams: true });

  router.get(
    '/promotions',
    requirePermission('collections', 'read'),
    [
      query('sourceBranch').optional().isString().trim().notEmpty(),
      query('targetBranch').optional().isString().trim().notEmpty(),
      query('status').optional().isIn(['pending', 'approved', 'consumed', 'rejected']),
      query('limit').optional().isInt({ min: 1, max: 100 }),
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondValidationError(res, 'Invalid promotions query', errors.array());
          return;
        }

        const { projectId } = req.params;
        ok(res, await listPromotionRequestsForQuery(projectId, req.query));
      } catch (error) {
        logger.error({ msg: 'List promotion requests error', error });
        internalError(res, 'Failed to load promotion requests');
      }
    }
  );

  router.post(
    '/promotions/request',
    requirePermission('collections', 'update'),
    [
      body('sourceBranch').isString().trim().notEmpty(),
      body('targetBranch').isString().trim().notEmpty(),
      body('reason').optional().isString().trim().notEmpty(),
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondValidationError(res, 'Invalid promotion request payload', errors.array());
          return;
        }

        const { projectId } = req.params;
        if (!req.user) {
          unauthorized(res, 'Authentication required');
          return;
        }
        const user = req.user;
        const { sourceBranch, targetBranch, reason } = req.body as { sourceBranch: string; targetBranch: string; reason?: string };
        const requestRecord = await createPromotionRequestOrRespond(req, res, projectId, user, {
          sourceBranch,
          targetBranch,
          reason,
        });
        if (!requestRecord) {
          return;
        }
        ok(res, { request: requestRecord });
      } catch (error) {
        logger.error({ msg: 'Create promotion request error', error });
        internalError(res, 'Failed to create promotion request');
      }
    }
  );

  router.post('/promotions/:requestId/approve', requirePermission('collections', 'publish'), async (req: Request, res: Response) => {
    try {
      const { projectId, requestId } = req.params;
      if (!req.user) {
        unauthorized(res, 'Authentication required');
        return;
      }
      const user = req.user;
      const approvedRecord = await approvePromotionRequestOrRespond(req, res, projectId, requestId, user);
      if (!approvedRecord) {
        return;
      }
      ok(res, { request: approvedRecord });
    } catch (error) {
      logger.error({ msg: 'Approve promotion request error', error });
      internalError(res, 'Failed to approve promotion request');
    }
  });

  router.post(
    '/promotions/:requestId/reject',
    requirePermission('collections', 'publish'),
    [body('reason').optional().isString().trim().notEmpty()],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondValidationError(res, 'Invalid reject payload', errors.array());
          return;
        }

        const { projectId, requestId } = req.params;
        if (!req.user) {
          unauthorized(res, 'Authentication required');
          return;
        }
        const user = req.user;
        const { reason } = req.body as { reason?: string };
        const rejectedRecord = await rejectPromotionRequestOrRespond(req, res, projectId, requestId, user, reason);
        if (!rejectedRecord) {
          return;
        }
        ok(res, { request: rejectedRecord });
      } catch (error) {
        logger.error({ msg: 'Reject promotion request error', error });
        internalError(res, 'Failed to reject promotion request');
      }
    }
  );

  router.get(
    '/promotions/conflicts/file',
    requirePermission('collections', 'read'),
    [
      query('sourceBranch').isString().trim().notEmpty(),
      query('targetBranch').isString().trim().notEmpty(),
      query('path').isString().trim().notEmpty(),
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondValidationError(res, 'Invalid conflict file query', errors.array());
          return;
        }

        const { projectId } = req.params;
        const sourceBranch = String(req.query.sourceBranch);
        const targetBranch = String(req.query.targetBranch);
        const filePath = String(req.query.path);
        ok(res, await getPromotionConflictFile(gitService, projectId, sourceBranch, targetBranch, filePath));
      } catch (error) {
        logger.error({ msg: 'Get promotion conflict file error', error });
        internalError(res, 'Failed to load conflict file content');
      }
    }
  );

  router.post(
    '/promotions/resolve',
    requirePermission('collections', 'update'),
    [
      body('sourceBranch').isString().trim().notEmpty(),
      body('targetBranch').isString().trim().notEmpty(),
      body('resolutions').isArray({ min: 1 }),
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondValidationError(res, 'Invalid resolve payload', errors.array());
          return;
        }

        const { projectId } = req.params;
        if (!req.user) {
          unauthorized(res, 'Authentication required');
          return;
        }
        const user = req.user;
        const { sourceBranch, targetBranch, resolutions } = req.body as {
          sourceBranch: string;
          targetBranch: string;
          resolutions: PromotionResolution[];
        };
        const result = await resolvePromotionConflictsOrRespond(req, res, gitService, projectId, user, {
          sourceBranch,
          targetBranch,
          resolutions,
        });
        if (!result) {
          return;
        }
        ok(res, result);
      } catch (error) {
        logger.error({ msg: 'Resolve promotion conflicts error', error });
        const { code, message } = formatGitError(error);
        internalError(res, message, code);
      }
    }
  );

  router.post(
    '/promote',
    requirePermission('collections', 'publish'),
    [
      body('sourceBranch').isString().trim().notEmpty(),
      body('targetBranch').isString().trim().notEmpty(),
      body('approvalId').isString().trim().notEmpty(),
      body('message').optional().isString().trim().notEmpty(),
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondValidationError(res, 'Invalid promote payload', errors.array());
          return;
        }

        const { projectId } = req.params;
        if (!req.user) {
          unauthorized(res, 'Authentication required');
          return;
        }
        const user = req.user;
        const { sourceBranch, targetBranch, approvalId, message } = req.body as { sourceBranch: string; targetBranch: string; approvalId: string; message?: string };
        const result = await promoteBranchesOrRespond(req, res, gitService, projectId, user, {
          sourceBranch,
          targetBranch,
          approvalId,
          message,
        });
        if (!result) {
          return;
        }
        ok(res, result);
      } catch (error) {
        logger.error({ msg: 'Promote branch error', error });
        const formatted = error && typeof error === 'object' && 'formattedGitError' in error
          ? (error as { formattedGitError: ReturnType<typeof formatGitError> }).formattedGitError
          : formatGitError(error);
        const { code, message: fallbackMessage } = formatted;
        internalError(res, fallbackMessage, code);
      }
    }
  );

  return router;
}
