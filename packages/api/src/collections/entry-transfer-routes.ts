import { Router, type Request, type Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { logger } from '../middleware/logger';
import { badRequest, ok } from '../lib/responses';
import { requirePermission } from '../permissions/middleware';
import {
  applyEntryBranchTransferOrRespond,
  parseEntryBranchTransferApplyPayloadOrRespond,
  previewEntryBranchTransferOrRespond,
  respondCollectionValidationError,
} from './route-support';

export function registerCollectionEntryTransferRoutes(router: Router): void {
  router.post(
    '/:collectionId/:id/branch-transfer/preview',
    [
      param('collectionId').trim().notEmpty(),
      param('id').trim().notEmpty(),
      body('sourceBranch').trim().notEmpty(),
      body('targetBranch').trim().notEmpty(),
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondCollectionValidationError(res, errors.mapped());
          return;
        }

        const { projectId, collectionId, id } = req.params as { projectId: string; collectionId: string; id: string };
        const { sourceBranch, targetBranch } = req.body as { sourceBranch: string; targetBranch: string };
        const preview = await previewEntryBranchTransferOrRespond(
          projectId,
          collectionId,
          id,
          sourceBranch,
          targetBranch,
          res,
        );
        if (!preview) {
          return;
        }

        ok(res, preview);
      } catch (error) {
        logger.error({ msg: 'Entry branch transfer preview error', error });
        badRequest(res, error instanceof Error ? error.message : 'Failed to preview entry branch transfer', 'ENTRY_BRANCH_TRANSFER_PREVIEW_FAILED');
      }
    },
  );

  router.post(
    '/:collectionId/:id/branch-transfer/apply',
    requirePermission('collections', 'update'),
    [
      param('collectionId').trim().notEmpty(),
      param('id').trim().notEmpty(),
      body('sourceBranch').trim().notEmpty(),
      body('targetBranch').trim().notEmpty(),
      body('mode').isIn(['entire_entry', 'selected_paths']),
      body('message').trim().notEmpty(),
      body('selectedPointers').optional().isArray(),
      body('selectedPointers.*').optional().isString(),
      body('resolutions').optional().isArray(),
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondCollectionValidationError(res, errors.mapped());
          return;
        }

        const { projectId, collectionId, id } = req.params as { projectId: string; collectionId: string; id: string };
        const payload = parseEntryBranchTransferApplyPayloadOrRespond(req.body, res);
        if (!payload) {
          return;
        }
        const result = await applyEntryBranchTransferOrRespond(
          req,
          res,
          projectId,
          collectionId,
          id,
          payload,
        );
        if (!result) {
          return;
        }

        ok(res, result);
      } catch (error) {
        logger.error({ msg: 'Entry branch transfer apply error', error });
        badRequest(res, error instanceof Error ? error.message : 'Failed to apply entry branch transfer', 'ENTRY_BRANCH_TRANSFER_APPLY_FAILED');
      }
    },
  );
}
