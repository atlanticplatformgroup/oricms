import { Router, type Request, type Response } from 'express';
import { param, body, validationResult } from 'express-validator';
import { logger } from '../middleware/logger';
import { conflict, created, internalError, normalizeValidationDetails, notFound, ok, validationError } from '../lib/responses';
import { LifecycleHookError } from '../plugins/dispatcher';
import { createContentType } from '../application/content-types/create-content-type';
import { updateContentType } from '../application/content-types/update-content-type';
import { deleteContentType } from '../application/content-types/delete-content-type';
import type { ContentType } from '@ori/shared';
import {
  attachContentTypeResource,
  buildContentTypeDefinition,
  buildUpdatedContentTypeDefinition,
  contentTypeExists,
  getContentTypeRequestActor,
  readContentTypeDefinition,
  resolveContentTypesWorkspace,
  listContentTypeDefinitions,
} from './route-support';

const router = Router({ mergeParams: true });

function respondValidationError(res: Response, details: unknown, message = 'Invalid input') {
  validationError(res, message, normalizeValidationDetails(details));
}

function respondProjectNotFound(res: Response) {
  notFound(res, 'Project not found', 'PROJECT_NOT_FOUND');
}

function respondLifecycleBlocked(res: Response, error: Error) {
  res.status(400).json({
    success: false,
    error: {
      code: 'LIFECYCLE_BLOCKED',
      message: error.message,
    },
  });
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params as { projectId: string };
    const workspace = await resolveContentTypesWorkspace(projectId);
    if (!workspace) {
      logger.warn({ msg: 'Project not found while listing content types', projectId });
      respondProjectNotFound(res);
      return;
    }
    const contentTypes = await listContentTypeDefinitions(workspace.workspacePath);

    ok(res, {
      contentTypes: contentTypes.map(attachContentTypeResource),
    });
  } catch (error) {
    logger.error({ msg: 'List content types error', error });
    internalError(res, 'Failed to load content types');
  }
});

router.get('/:typeId', async (req: Request, res: Response) => {
  try {
    const { projectId, typeId } = req.params as { projectId: string; typeId: string };
    const workspace = await resolveContentTypesWorkspace(projectId);
    if (!workspace) {
      respondProjectNotFound(res);
      return;
    }
    const typeDef = await readContentTypeDefinition(workspace.workspacePath, typeId);
    if (!typeDef) {
      notFound(res, 'Content type not found');
      return;
    }

    ok(res, {
      contentType: attachContentTypeResource(typeDef),
    });
  } catch (error) {
    logger.error({ msg: 'Get content type error', error });
    internalError(res, 'Failed to load content type');
  }
});

router.post(
  '/',
  [
    body('name').trim().isLength({ min: 1, max: 50 }).matches(/^[a-z][a-z0-9_]*$/),
    body('plural').trim().isLength({ min: 1, max: 50 }),
    body('label').trim().isLength({ min: 1, max: 100 }),
    body('labelPlural').trim().isLength({ min: 1, max: 100 }),
    body('fields').isArray({ min: 1 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        respondValidationError(res, errors.mapped());
        return;
      }

      const { projectId } = req.params as { projectId: string };
      const { name } = req.body;

      const workspace = await resolveContentTypesWorkspace(projectId);
      if (!workspace) {
        respondProjectNotFound(res);
        return;
      }
      if (await contentTypeExists(workspace.workspacePath, name)) {
        conflict(res, 'Content type already exists', 'ALREADY_EXISTS');
        return;
      }

      const contentType: ContentType = buildContentTypeDefinition(req.body as Record<string, unknown>);

      await createContentType(
        {
          projectId,
          actor: getContentTypeRequestActor(req),
        },
        contentType,
        {
          audit: {
            userId: req.user?.id,
            action: 'contentType.create',
          },
        },
        { gitService: workspace.gitService },
      );

      created(res, { contentType });
    } catch (error) {
      if (error instanceof LifecycleHookError) {
        respondLifecycleBlocked(res, error);
        return;
      }
      logger.error({ msg: 'Create content type error', error });
      internalError(res, 'Failed to create content type');
    }
  }
);

router.put(
  '/:typeId',
  [
    param('typeId').trim().notEmpty(),
    body('plural').optional().trim().isLength({ min: 1 }),
    body('label').optional().trim().isLength({ min: 1 }),
    body('labelPlural').optional().trim().isLength({ min: 1 }),
    body('fields').optional().isArray(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        respondValidationError(res, errors.mapped());
        return;
      }

      const { projectId, typeId } = req.params as { projectId: string; typeId: string };
      const workspace = await resolveContentTypesWorkspace(projectId);
      if (!workspace) {
        respondProjectNotFound(res);
        return;
      }
      const existingType = await readContentTypeDefinition(workspace.workspacePath, typeId);
      if (!existingType) {
        notFound(res, 'Content type not found');
        return;
      }

      const updatedType: ContentType = buildUpdatedContentTypeDefinition(
        existingType,
        typeId,
        req.body as Record<string, unknown>,
      );

      await updateContentType(
        {
          projectId,
          actor: getContentTypeRequestActor(req),
        },
        updatedType,
        {
          audit: {
            userId: req.user?.id,
            action: 'contentType.update',
          },
        },
        { gitService: workspace.gitService },
      );

      ok(res, { contentType: updatedType });
    } catch (error) {
      if (error instanceof LifecycleHookError) {
        respondLifecycleBlocked(res, error);
        return;
      }
      logger.error({ msg: 'Update content type error', error });
      internalError(res, 'Failed to update content type');
    }
  }
);

router.delete('/:typeId', async (req: Request, res: Response) => {
  try {
    const { projectId, typeId } = req.params as { projectId: string; typeId: string };
    const deleteRecords = req.query.deleteRecords === 'true';
    const workspace = await resolveContentTypesWorkspace(projectId);
    if (!workspace) {
      respondProjectNotFound(res);
      return;
    }
    const existingType = await readContentTypeDefinition(workspace.workspacePath, typeId);
    if (!existingType) {
      notFound(res, 'Content type not found');
      return;
    }

      await deleteContentType(
        {
          projectId,
          actor: getContentTypeRequestActor(req),
        },
      existingType,
      {
        deleteRecords,
        audit: {
          userId: req.user?.id,
          action: 'contentType.delete',
        },
      },
      { gitService: workspace.gitService },
    );

    ok(res, { message: 'Content type deleted' });
  } catch (error) {
    if (error instanceof LifecycleHookError) {
      respondLifecycleBlocked(res, error);
      return;
    }
    logger.error({ msg: 'Delete content type error', error });
    internalError(res, 'Failed to delete content type');
  }
});

export default router;
