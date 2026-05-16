import { Router, type Request, type Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { logger } from '../middleware/logger';
import {
  created,
  normalizeValidationDetails,
  ok,
  validationError,
} from '../lib/responses';
import {
  createCollectionEntryOrRespond,
  deleteCollectionEntryOrRespond,
  parseEntryDeleteBody,
  parseEntryUpdateBody,
  respondCollectionValidationError,
  respondEntryMutationError,
  updateCollectionEntryOrRespond,
} from './route-support';

export function registerCollectionEntryMutationRoutes(router: Router): void {
  router.post(
    '/:collectionId',
    [
      param('collectionId').trim().notEmpty(),
      body().isObject(),
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          validationError(res, 'Invalid input', normalizeValidationDetails(errors.mapped()));
          return;
        }

        const { projectId, collectionId } = req.params as { projectId: string; collectionId: string };
        const data = req.body;
        const result = await createCollectionEntryOrRespond(req, res, projectId, collectionId, data);
        if (!result) {
          return;
        }

        const { entry, revision } = result;
        created(res, { entry, meta: { revision } });
      } catch (error) {
        logger.error({ msg: 'Create collection entry error', error });
        respondEntryMutationError(res, error, 'Failed to create entry', 'CREATE_FAILED');
      }
    },
  );

  router.put(
    '/:collectionId/:id',
    [
      param('collectionId').trim().notEmpty(),
      param('id').trim().notEmpty(),
      body().isObject(),
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondCollectionValidationError(res, errors.mapped());
          return;
        }

        const { projectId, collectionId, id } = req.params as { projectId: string; collectionId: string; id: string };
        const { data, baseRevision } = parseEntryUpdateBody(req.body);
        const result = await updateCollectionEntryOrRespond(req, res, projectId, collectionId, id, data, baseRevision);
        if (!result) {
          return;
        }

        const { entry, revision } = result;
        ok(res, { entry, meta: { revision } });
      } catch (error) {
        logger.error({ msg: 'Update collection entry error', error });
        respondEntryMutationError(res, error, 'Failed to update entry', 'UPDATE_FAILED');
      }
    },
  );

  router.delete(
    '/:collectionId/:id',
    [
      param('collectionId').trim().notEmpty(),
      param('id').trim().notEmpty(),
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondCollectionValidationError(res, errors.mapped());
          return;
        }

        const { projectId, collectionId, id } = req.params as { projectId: string; collectionId: string; id: string };
        const { baseRevision } = parseEntryDeleteBody(req.body);
        const deleted = await deleteCollectionEntryOrRespond(req, res, projectId, collectionId, id, baseRevision);
        if (!deleted) {
          return;
        }

        ok(res, { message: 'Entry deleted' });
      } catch (error) {
        logger.error({ msg: 'Delete collection entry error', error });
        respondEntryMutationError(res, error, 'Failed to delete entry', 'DELETE_FAILED');
      }
    },
  );
}
