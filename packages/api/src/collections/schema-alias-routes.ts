import { Router, type Request, type Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { logger } from '../middleware/logger';
import {
  badRequest,
  created,
  internalError,
  lifecycleBlocked,
  normalizeValidationDetails,
  notFound,
  ok,
  validationError,
} from '../lib/responses';
import { LifecycleHookError } from '../plugins/dispatcher';
import { requirePermission } from '../permissions/middleware';
import { CollectionValidationError } from './service';
import {
  applyEntryBranchTransferOrRespond,
  createCollectionEntryOrRespond,
  deleteCollectionEntryOrRespond,
  deleteCollectionOrRespond,
  getCollectionEntriesOrRespond,
  getCollectionEntryOrRespond,
  getEntryHistoryOrRespond,
  getEntryVersionOrRespond,
  listCollectionsOrRespond,
  parseEntryBranchTransferApplyPayloadOrRespond,
  parseEntryDeleteBody,
  parseEntryHistoryRequest,
  parseEntryUpdateBody,
  previewEntryBranchTransferOrRespond,
  respondCollectionValidationError,
  respondEntryMutationError,
  updateCollectionEntryOrRespond,
  updateCollectionsOrRespond,
} from './route-support';

const router = Router({ mergeParams: true });

function schemaIdParam() {
  return param('schemaId').trim().notEmpty();
}

// Schema-first public aliases. Internally these still delegate to the existing
// collection-backed storage and lifecycle helpers while the deeper rename lands.
router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params as { projectId: string };
    const result = await listCollectionsOrRespond(projectId, res);
    if (!result) {
      logger.warn({ msg: 'Project not found while listing schemas', projectId });
      return;
    }
    ok(res, result);
  } catch (error) {
    logger.error({ msg: 'List schemas error', error });
    internalError(res, 'Failed to load schemas');
  }
});

router.put(
  '/',
  requirePermission('schemas', 'update'),
  [
    body('schemas').optional().isArray(),
    body('collections').optional().isArray(),
    body().custom((value) => {
      if (!Array.isArray(value?.schemas) && !Array.isArray(value?.collections)) {
        throw new Error('schemas array is required');
      }
      return true;
    }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        respondCollectionValidationError(res, errors.array());
        return;
      }

      const { projectId } = req.params as { projectId: string };
      const schemas = Array.isArray(req.body.schemas) ? req.body.schemas : req.body.collections;
      if (!(await updateCollectionsOrRespond(req, res, projectId, schemas))) {
        return;
      }
      ok(res, { message: 'Schemas updated' });
    } catch (error) {
      if (error instanceof LifecycleHookError) {
        lifecycleBlocked(res, error.message);
        return;
      }
      if (error instanceof CollectionValidationError) {
        logger.warn({ msg: 'Update schemas validation failed', error: error.message });
        respondCollectionValidationError(res, undefined, error.message);
        return;
      }
      logger.error({ msg: 'Update schemas error', error });
      internalError(res, error instanceof Error ? error.message : 'Failed to update schemas');
    }
  },
);

router.delete(
  '/:schemaId',
  requirePermission('schemas', 'delete'),
  [schemaIdParam()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        respondCollectionValidationError(res, errors.mapped());
        return;
      }

      const { projectId, schemaId } = req.params as { projectId: string; schemaId: string };
      if (!(await deleteCollectionOrRespond(req, res, projectId, schemaId))) {
        return;
      }
      ok(res, { message: 'Schema deleted' });
    } catch (error) {
      if (error instanceof LifecycleHookError) {
        lifecycleBlocked(res, error.message);
        return;
      }
      logger.error({ msg: 'Delete schema error', error });
      badRequest(res, error instanceof Error ? error.message : 'Failed to delete schema', 'DELETE_SCHEMA_FAILED');
    }
  },
);

router.get(
  '/:schemaId/entries',
  [
    schemaIdParam(),
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

      const { projectId, schemaId } = req.params as { projectId: string; schemaId: string };
      const result = await getCollectionEntriesOrRespond(req, res, projectId, schemaId);
      if (!result) return;
      ok(res, result);
    } catch (error) {
      logger.error({ msg: 'List schema entries error', error });
      internalError(res, error instanceof Error ? error.message : 'Failed to load entries');
    }
  },
);

router.post(
  '/:schemaId/entries',
  requirePermission('entries', 'create'),
  [schemaIdParam(), body().isObject()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        validationError(res, 'Invalid input', normalizeValidationDetails(errors.mapped()));
        return;
      }
      const { projectId, schemaId } = req.params as { projectId: string; schemaId: string };
      const result = await createCollectionEntryOrRespond(req, res, projectId, schemaId, req.body);
      if (!result) return;
      const { entry, revision } = result;
      created(res, { entry, meta: { revision } });
    } catch (error) {
      logger.error({ msg: 'Create schema entry error', error });
      respondEntryMutationError(res, error, 'Failed to create entry', 'CREATE_FAILED');
    }
  },
);

router.get(
  '/:schemaId/entries/:id',
  [schemaIdParam(), param('id').trim().notEmpty(), query('populate').optional().trim()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        validationError(res, 'Invalid input', normalizeValidationDetails(errors.mapped()));
        return;
      }
      const { projectId, schemaId, id } = req.params as { projectId: string; schemaId: string; id: string };
      const result = await getCollectionEntryOrRespond(projectId, schemaId, id, req.query.populate as string | undefined, res);
      if (!result) return;
      ok(res, result);
    } catch (error) {
      logger.error({ msg: 'Get schema entry error', error });
      internalError(res, error instanceof Error ? error.message : 'Failed to load entry');
    }
  },
);

router.put(
  '/:schemaId/entries/:id',
  requirePermission('entries', 'update'),
  [schemaIdParam(), param('id').trim().notEmpty(), body().isObject()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        respondCollectionValidationError(res, errors.mapped());
        return;
      }
      const { projectId, schemaId, id } = req.params as { projectId: string; schemaId: string; id: string };
      const { data, baseRevision } = parseEntryUpdateBody(req.body);
      const result = await updateCollectionEntryOrRespond(req, res, projectId, schemaId, id, data, baseRevision);
      if (!result) return;
      const { entry, revision } = result;
      ok(res, { entry, meta: { revision } });
    } catch (error) {
      logger.error({ msg: 'Update schema entry error', error });
      respondEntryMutationError(res, error, 'Failed to update entry', 'UPDATE_FAILED');
    }
  },
);

router.delete(
  '/:schemaId/entries/:id',
  requirePermission('entries', 'delete'),
  [schemaIdParam(), param('id').trim().notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        respondCollectionValidationError(res, errors.mapped());
        return;
      }
      const { projectId, schemaId, id } = req.params as { projectId: string; schemaId: string; id: string };
      const { baseRevision } = parseEntryDeleteBody(req.body);
      const deleted = await deleteCollectionEntryOrRespond(req, res, projectId, schemaId, id, baseRevision);
      if (!deleted) return;
      ok(res, { message: 'Entry deleted' });
    } catch (error) {
      logger.error({ msg: 'Delete schema entry error', error });
      respondEntryMutationError(res, error, 'Failed to delete entry', 'DELETE_FAILED');
    }
  },
);

router.get(
  '/:schemaId/entries/:id/history',
  [schemaIdParam(), param('id').trim().notEmpty(), query('limit').optional().isInt({ min: 1, max: 100 }).toInt(), query('branch').optional().isString().trim()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        validationError(res, 'Invalid input', normalizeValidationDetails(errors.mapped()));
        return;
      }
      const { projectId, schemaId, id } = req.params as { projectId: string; schemaId: string; id: string };
      const { limit, branch } = parseEntryHistoryRequest(req);
      const result = await getEntryHistoryOrRespond(projectId, schemaId, id, limit, branch, res);
      if (!result) return;
      ok(res, result);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'NOT_FOUND') {
        notFound(res, (error as { message?: string }).message || 'Not found');
        return;
      }
      logger.error({ msg: 'Get schema entry history error', error });
      internalError(res, error instanceof Error ? error.message : 'Failed to load history');
    }
  },
);

router.get(
  '/:schemaId/entries/:id/history/:hash',
  [schemaIdParam(), param('id').trim().notEmpty(), param('hash').trim().notEmpty(), query('branch').optional().isString().trim()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        validationError(res, 'Invalid input', normalizeValidationDetails(errors.mapped()));
        return;
      }
      const { projectId, schemaId, id, hash } = req.params as { projectId: string; schemaId: string; id: string; hash: string };
      const result = await getEntryVersionOrRespond(projectId, schemaId, id, hash, req.query.branch as string | undefined, res);
      if (!result) return;
      ok(res, result);
    } catch (error: unknown) {
      logger.error({ msg: 'Get schema entry version error', error });
      internalError(res, error instanceof Error ? error.message : 'Failed to load version');
    }
  },
);

router.post(
  '/:schemaId/entries/:id/branch-transfer/preview',
  [schemaIdParam(), param('id').trim().notEmpty(), body('sourceBranch').trim().notEmpty(), body('targetBranch').trim().notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        respondCollectionValidationError(res, errors.mapped());
        return;
      }
      const { projectId, schemaId, id } = req.params as { projectId: string; schemaId: string; id: string };
      const { sourceBranch, targetBranch } = req.body as { sourceBranch: string; targetBranch: string };
      const preview = await previewEntryBranchTransferOrRespond(projectId, schemaId, id, sourceBranch, targetBranch, res);
      if (!preview) return;
      ok(res, preview);
    } catch (error) {
      logger.error({ msg: 'Schema entry branch transfer preview error', error });
      badRequest(res, error instanceof Error ? error.message : 'Failed to preview entry branch transfer', 'ENTRY_BRANCH_TRANSFER_PREVIEW_FAILED');
    }
  },
);

router.post(
  '/:schemaId/entries/:id/branch-transfer/apply',
  requirePermission('entries', 'update'),
  [
    schemaIdParam(),
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
      const { projectId, schemaId, id } = req.params as { projectId: string; schemaId: string; id: string };
      const payload = parseEntryBranchTransferApplyPayloadOrRespond(req.body, res);
      if (!payload) return;
      const result = await applyEntryBranchTransferOrRespond(req, res, projectId, schemaId, id, payload);
      if (!result) return;
      ok(res, result);
    } catch (error) {
      logger.error({ msg: 'Schema entry branch transfer apply error', error });
      badRequest(res, error instanceof Error ? error.message : 'Failed to apply entry branch transfer', 'ENTRY_BRANCH_TRANSFER_APPLY_FAILED');
    }
  },
);

export default router;
