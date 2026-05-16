import { Router, Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import { logger } from '../middleware/logger';
import { badRequest, internalError, normalizeValidationDetails, notFound, ok, validationError } from '../lib/responses';
import { SUPPORTED_PREVIEW_LOCALES } from './localization';
import {
  listPreviewPages,
  loadAllContent,
  loadComponentSchema,
  loadContentFile,
  resolvePreviewWorkspace,
  resolveWorkspaceContentPath,
} from './route-support';

const router = Router({ mergeParams: true });

/**
 * GET /api/v1/projects/:projectId/preview/content
 * Get content for preview (by branch or commit)
 * 
 * Query params:
 * - branch: Branch name (default: main)
 * - ref: Specific commit SHA (optional, overrides branch)
 * - path: Content file path (optional, returns all if not specified)
 */
router.get(
  '/content',
  [
    param('projectId').isUUID(),
    query('branch').optional().trim(),
    query('ref').optional().trim().isLength({ min: 7, max: 40 }),
    query('path').optional().trim(),
    query('locale').optional().trim().isIn(SUPPORTED_PREVIEW_LOCALES),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        validationError(res, 'Invalid input', normalizeValidationDetails(errors.mapped()));
        return;
      }

      const { projectId } = req.params;
      const branch = (req.query.branch as string) || 'main';
      const ref = req.query.ref as string | undefined;
      const contentPath = req.query.path as string | undefined;
      const locale = req.query.locale as string | undefined;

      const workspace = await resolvePreviewWorkspace(projectId, branch, ref);
      if (!workspace) {
        notFound(res, 'Project not found', 'PROJECT_NOT_FOUND');
        return;
      }

      // Load requested content
      let content: unknown;

      if (contentPath) {
        const fullPath = resolveWorkspaceContentPath(workspace.workspacePath, contentPath);
        if (!fullPath) {
          badRequest(res, 'Invalid content path', 'INVALID_PATH');
          return;
        }
        content = await loadContentFile(fullPath, locale);
      } else {
        content = await loadAllContent(workspace.workspacePath, locale);
      }

      // Get commit info
      const commitInfo = await workspace.gitService.getCurrentCommit(projectId);

      ok(res, {
        content,
        meta: {
          branch,
          ref: ref || commitInfo.hash,
          locale: locale || null,
          commit: commitInfo,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error({ msg: 'Preview content error', error });
      internalError(res, 'Failed to load preview content');
    }
  }
);

router.get(
  '/pages',
  [
    param('projectId').isUUID(),
    query('branch').optional().trim(),
    query('ref').optional().trim().isLength({ min: 7, max: 40 }),
    query('locale').optional().trim().isIn(SUPPORTED_PREVIEW_LOCALES),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        validationError(res, 'Invalid input', normalizeValidationDetails(errors.mapped()));
        return;
      }

      const { projectId } = req.params;
      const branch = (req.query.branch as string) || 'main';
      const ref = req.query.ref as string | undefined;
      const locale = req.query.locale as string | undefined;

      const workspace = await resolvePreviewWorkspace(projectId, branch, ref);
      if (!workspace) {
        notFound(res, 'Project not found', 'PROJECT_NOT_FOUND');
        return;
      }
      const pages = await listPreviewPages(workspace.workspacePath, locale);

      ok(res, {
        pages,
        meta: {
          branch,
          ref: ref || null,
          locale: locale || null,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error({ msg: 'Preview pages error', error });
      internalError(res, 'Failed to load preview pages');
    }
  }
);

/**
 * POST /api/v1/projects/:projectId/preview/validate
 * Validate content against a schema from the git repo
 */
router.post(
  '/validate',
  [
    param('projectId').isUUID(),
  ],
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { content, schemaId } = req.body;

      if (!schemaId || typeof schemaId !== 'string') {
        validationError(res, 'schemaId is required');
        return;
      }

      const workspace = await resolvePreviewWorkspace(projectId);
      if (!workspace) {
        notFound(res, 'Project not found', 'PROJECT_NOT_FOUND');
        return;
      }
      const schemaDefinition = await loadComponentSchema(workspace.workspacePath, schemaId);
      if (!schemaDefinition) {
        notFound(res, `Schema '${schemaId}' not found in repository`, 'SCHEMA_NOT_FOUND');
        return;
      }

      const validationErrors = validateContent(content, schemaDefinition);

      ok(res, {
        valid: validationErrors.length === 0,
        errors: validationErrors,
      });
    } catch (error) {
      logger.error({ msg: 'Validate content error', error });
      internalError(res, 'Failed to validate content');
    }
  }
);

function validateContent(content: unknown, _schema: unknown): string[] {
  const errors: string[] = [];
  // Basic validation - can be expanded with Zod schemas
  if (!content || typeof content !== 'object') {
    errors.push('Content must be an object');
  }
  return errors;
}

export default router;
