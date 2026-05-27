import { Router, type Request, type Response } from 'express';
import { query, validationResult } from 'express-validator';
import { forbidden, internalError, notFound, ok, validationError } from '../lib/responses';
import { logger } from '../middleware/logger';
import { getUserRole } from '../permissions/middleware';
import { ResourceService } from './service';

const router = Router({ mergeParams: true });

async function createResourceService(req: Request, res: Response): Promise<ResourceService | null> {
  const { projectId } = req.params as { projectId: string };
  const userId = req.userId;

  if (!userId) {
    forbidden(res, 'Authentication required');
    return null;
  }

  const role = await getUserRole(userId, projectId);
  if (!role) {
    forbidden(res, 'Project membership required');
    return null;
  }

  return new ResourceService(projectId, role);
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const service = await createResourceService(req, res);
    if (!service) {
      return;
    }

    const resources = await service.listResourceCollections();
    ok(res, {
      resources: resources.filter((resource) => resource.capabilities.canRead),
    });
  } catch (error) {
    logger.error({ msg: 'List resources error', error });
    internalError(res, 'Failed to load resources');
  }
});

router.get('/:resourceCollectionId', async (req: Request, res: Response) => {
  try {
    const service = await createResourceService(req, res);
    if (!service) {
      return;
    }

    const resource = await service.getResourceCollection(req.params.resourceCollectionId);
    if (!resource || !resource.capabilities.canRead) {
      notFound(res, 'Resource collection not found', 'RESOURCE_COLLECTION_NOT_FOUND');
      return;
    }

    ok(res, { resource });
  } catch (error) {
    logger.error({ msg: 'Get resource collection error', error });
    internalError(res, 'Failed to load resource collection');
  }
});

router.get('/:resourceCollectionId/schema', async (req: Request, res: Response) => {
  try {
    const service = await createResourceService(req, res);
    if (!service) {
      return;
    }

    const resource = await service.getResourceCollection(req.params.resourceCollectionId);
    if (!resource || !resource.capabilities.canRead) {
      notFound(res, 'Resource collection not found', 'RESOURCE_COLLECTION_NOT_FOUND');
      return;
    }

    const schema = await service.getResourceSchema(req.params.resourceCollectionId);
    if (!schema) {
      notFound(res, 'Resource schema not found', 'RESOURCE_SCHEMA_NOT_FOUND');
      return;
    }

    ok(res, { schema });
  } catch (error) {
    logger.error({ msg: 'Get resource schema error', error });
    internalError(res, 'Failed to load resource schema');
  }
});

router.get('/:resourceCollectionId/policy', async (req: Request, res: Response) => {
  try {
    const service = await createResourceService(req, res);
    if (!service) {
      return;
    }

    const resource = await service.getResourceCollection(req.params.resourceCollectionId);
    if (!resource || !resource.capabilities.canRead) {
      notFound(res, 'Resource collection not found', 'RESOURCE_COLLECTION_NOT_FOUND');
      return;
    }

    ok(res, { policy: resource.policySummary, capabilities: resource.capabilities });
  } catch (error) {
    logger.error({ msg: 'Get resource policy error', error });
    internalError(res, 'Failed to load resource policy');
  }
});

router.get(
  '/:resourceCollectionId/records',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        validationError(res, 'Invalid input');
        return;
      }

      const service = await createResourceService(req, res);
      if (!service) {
        return;
      }

      const resource = await service.getResourceCollection(req.params.resourceCollectionId);
      if (!resource || !resource.capabilities.canRead) {
        notFound(res, 'Resource collection not found', 'RESOURCE_COLLECTION_NOT_FOUND');
        return;
      }

      const page = typeof req.query.page === 'number' ? req.query.page : 1;
      const limit = Math.min(typeof req.query.limit === 'number' ? req.query.limit : 20, 100);
      const { records, total } = await service.listRecords(req.params.resourceCollectionId, {
        page,
        limit,
      });

      ok(res, {
        records,
        pagination: {
          page,
          limit,
          total,
          pageCount: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error({ msg: 'List resource records error', error });
      if (error instanceof Error && error.message === 'RESOURCE_NOT_FOUND') {
        notFound(res, 'Resource collection not found', 'RESOURCE_COLLECTION_NOT_FOUND');
        return;
      }
      internalError(res, 'Failed to load resource records');
    }
  },
);

router.get('/:resourceCollectionId/records/:recordId(*)', async (req: Request, res: Response) => {
  try {
    const service = await createResourceService(req, res);
    if (!service) {
      return;
    }

    const resource = await service.getResourceCollection(req.params.resourceCollectionId);
    if (!resource || !resource.capabilities.canRead) {
      notFound(res, 'Resource collection not found', 'RESOURCE_COLLECTION_NOT_FOUND');
      return;
    }

    const record = await service.getRecord(req.params.resourceCollectionId, req.params.recordId);
    if (!record) {
      notFound(res, 'Resource record not found', 'RESOURCE_RECORD_NOT_FOUND');
      return;
    }

    ok(res, { record });
  } catch (error) {
    logger.error({ msg: 'Get resource record error', error });
    internalError(res, 'Failed to load resource record');
  }
});

export default router;
