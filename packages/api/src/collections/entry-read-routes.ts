import { Router, type Request, type Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import { requirePermission } from '../permissions/middleware';
import { logger } from '../middleware/logger';
import {
  internalError,
  normalizeValidationDetails,
  notFound,
  ok,
  validationError,
} from '../lib/responses';
import {
  getCollectionEntriesOrRespond,
  getCollectionEntryOrRespond,
  getEntryHistoryOrRespond,
  getEntryVersionOrRespond,
  parseEntryHistoryRequest,
  respondCollectionValidationError,
} from './route-support';

export function registerCollectionEntryReadRoutes(router: Router): void {
  router.get(
    '/:collectionId',
    requirePermission('collections', 'read'),
    [
      param('collectionId').trim().notEmpty(),
      query('filter').optional().isJSON(),
      query('sort').optional().isJSON(),
      query('page').optional().isInt({ min: 1 }).toInt(),
      query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
      query('populate').optional().trim(),
      query('search').optional().trim(),
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          respondCollectionValidationError(res, errors.mapped());
          return;
        }

        const { projectId, collectionId } = req.params as { projectId: string; collectionId: string };
        const result = await getCollectionEntriesOrRespond(req, res, projectId, collectionId);
        if (!result) return;

        ok(res, result);
      } catch (error) {
        logger.error({ msg: 'List collection entries error', error });
        internalError(res, error instanceof Error ? error.message : 'Failed to load entries');
      }
    },
  );

  router.get(
    '/:collectionId/:id',
    requirePermission('collections', 'read'),
    [
      param('collectionId').trim().notEmpty(),
      param('id').trim().notEmpty(),
      query('populate').optional().trim(),
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          validationError(res, 'Invalid input', normalizeValidationDetails(errors.mapped()));
          return;
        }

        const { projectId, collectionId, id } = req.params as { projectId: string; collectionId: string; id: string };
        const populate = req.query.populate as string | undefined;
        const result = await getCollectionEntryOrRespond(projectId, collectionId, id, populate, res);
        if (!result) return;

        ok(res, result);
      } catch (error) {
        logger.error({ msg: 'Get collection entry error', error });
        internalError(res, error instanceof Error ? error.message : 'Failed to load entry');
      }
    },
  );

  router.get(
    '/:collectionId/:id/history',
    requirePermission('collections', 'read'),
    [
      param('collectionId').trim().notEmpty(),
      param('id').trim().notEmpty(),
      query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
      query('branch').optional().isString().trim(),
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          validationError(res, 'Invalid input', normalizeValidationDetails(errors.mapped()));
          return;
        }

        const { projectId, collectionId, id } = req.params as { projectId: string; collectionId: string; id: string };
        const { limit, branch } = parseEntryHistoryRequest(req);
        const historyResult = await getEntryHistoryOrRespond(projectId, collectionId, id, limit, branch, res);
        if (!historyResult) return;

        ok(res, historyResult);
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'NOT_FOUND') {
          notFound(res, (error as { message?: string }).message || 'Not found');
          return;
        }
        logger.error({ msg: 'Get entry history error', error });
        internalError(res, error instanceof Error ? error.message : 'Failed to load history');
      }
    },
  );

  router.get(
    '/:collectionId/:id/history/:hash',
    requirePermission('collections', 'read'),
    [
      param('collectionId').trim().notEmpty(),
      param('id').trim().notEmpty(),
      param('hash').trim().notEmpty(),
      query('branch').optional().isString().trim(),
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          validationError(res, 'Invalid input', normalizeValidationDetails(errors.mapped()));
          return;
        }

        const { projectId, collectionId, id, hash } = req.params as { projectId: string; collectionId: string; id: string; hash: string };
        const branch = req.query.branch as string | undefined;
        const versionResult = await getEntryVersionOrRespond(projectId, collectionId, id, hash, branch, res);
        if (!versionResult) return;

        ok(res, versionResult);
      } catch (error: unknown) {
        logger.error({ msg: 'Get entry version error', error });
        internalError(res, error instanceof Error ? error.message : 'Failed to load version');
      }
    },
  );
}
