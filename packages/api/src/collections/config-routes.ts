import { Router, type Request, type Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { logger } from '../middleware/logger';
import {
  badRequest,
  internalError,
  lifecycleBlocked,
  ok,
} from '../lib/responses';
import { LifecycleHookError } from '../plugins/dispatcher';
import { requirePermission } from '../permissions/middleware';
import { CollectionValidationError } from './service';
import {
  deleteCollectionOrRespond,
  listCollectionsOrRespond,
  respondCollectionValidationError,
  updateCollectionsOrRespond,
} from './route-support';

export function registerCollectionConfigRoutes(router: Router): void {
  router.get(
    '/',
    async (req: Request, res: Response) => {
      try {
        const { projectId } = req.params as { projectId: string };
        const result = await listCollectionsOrRespond(projectId, res);
        if (!result) {
          logger.warn({ msg: 'Project not found while listing collections', projectId });
          return;
        }

        ok(res, result);
      } catch (error) {
        logger.error({ msg: 'List collections error', error });
        internalError(res, 'Failed to load collections');
      }
    },
  );

  router.put(
    '/',
    requirePermission('collections', 'update'),
    [
      body('collections').isArray(),
      body('collections.*.id').trim().notEmpty(),
      body('collections.*.label').trim().notEmpty(),
      body('collections.*.contentType').trim().notEmpty(),
      body('collections.*.path').trim().notEmpty(),
      body('collections.*.routing').optional().isObject(),
      body('collections.*.routing.enabled').optional().isBoolean(),
      body('collections.*.routing.slugPattern').optional().isString(),
      body('collections.*.routing.homepageId').optional().isString(),
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondCollectionValidationError(res, errors.array());
          return;
        }

        const { projectId } = req.params as { projectId: string };
        const { collections } = req.body;
        if (!(await updateCollectionsOrRespond(req, res, projectId, collections))) {
          return;
        }

        ok(res, { message: 'Collections updated' });
      } catch (error) {
        if (error instanceof LifecycleHookError) {
          lifecycleBlocked(res, error.message);
          return;
        }
        if (error instanceof CollectionValidationError) {
          logger.warn({ msg: 'Update collections validation failed', error: error.message });
          respondCollectionValidationError(res, undefined, error.message);
          return;
        }
        logger.error({ msg: 'Update collections error', error });
        internalError(res, error instanceof Error ? error.message : 'Failed to update collections');
      }
    },
  );

  router.delete(
    '/:collectionId',
    requirePermission('collections', 'delete'),
    [param('collectionId').trim().notEmpty()],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondCollectionValidationError(res, errors.mapped());
          return;
        }

        const { projectId, collectionId } = req.params as { projectId: string; collectionId: string };
        if (!(await deleteCollectionOrRespond(req, res, projectId, collectionId))) {
          return;
        }

        ok(res, { message: 'Collection deleted' });
      } catch (error) {
        if (error instanceof LifecycleHookError) {
          lifecycleBlocked(res, error.message);
          return;
        }
        logger.error({ msg: 'Delete collection error', error });
        badRequest(res, error instanceof Error ? error.message : 'Failed to delete collection', 'DELETE_COLLECTION_FAILED');
      }
    },
  );
}
