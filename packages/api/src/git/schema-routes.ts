import { Router, type Request, type Response } from 'express';
import { requirePermission } from '../permissions/middleware';
import { pageContentSchema } from '../lib/validation';
import { logger } from '../middleware/logger';
import { internalError, notFound, ok, unauthorized } from '../lib/responses';
import { saveSchema } from '../application/schemas/save-schema';
import { deleteSchema } from '../application/schemas/delete-schema';
import { formatGitError, isLifecycleHookError, normalizeSchemaPath, respondLifecycleBlocked, respondValidationError } from './helpers';
import type { GitService } from './service';
import { ensureResourceNotLocked } from '../locks/middleware';
import { query, validationResult } from 'express-validator';

export function createSchemaRoutes(gitService: GitService): Router {
  const router = Router({ mergeParams: true });

  router.get('/', requirePermission('collections', 'read'), [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ], async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        respondValidationError(res, 'Invalid schema list parameters', errors.array());
        return;
      }

      const { projectId } = req.params;
      const { branch } = req.query;
      const page = typeof req.query.page === 'number' ? req.query.page : 1;
      const limit = Math.min(typeof req.query.limit === 'number' ? req.query.limit : 50, 100);

      const listSchemaDir = async (directory: string) => {
        try {
          return await gitService.listFiles(projectId, directory, branch as string);
        } catch {
          return [];
        }
      };
      const [componentSchemas, typeSchemas] = await Promise.all([
        listSchemaDir('schemas/components'),
        listSchemaDir('schemas/types'),
      ]);
      const allSchemas = [...componentSchemas, ...typeSchemas].sort((a, b) => a.path.localeCompare(b.path));
      const total = allSchemas.length;
      const start = (page - 1) * limit;
      const schemas = allSchemas.slice(start, start + limit);

      ok(res, {
        schemas,
        pagination: { page, limit, total, pageCount: Math.ceil(total / limit) },
      });
    } catch (error) {
      logger.error({ msg: 'List schemas error', error });
      const { code, message } = formatGitError(error);
      internalError(res, message, code);
    }
  });

  router.get('/types', requirePermission('collections', 'read'), [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ], async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        respondValidationError(res, 'Invalid schema list parameters', errors.array());
        return;
      }

      const { projectId } = req.params;
      const { branch } = req.query;
      const page = typeof req.query.page === 'number' ? req.query.page : 1;
      const limit = Math.min(typeof req.query.limit === 'number' ? req.query.limit : 50, 100);
      const allSchemas = await gitService.listFiles(projectId, 'schemas/types', branch as string);
      const total = allSchemas.length;
      const start = (page - 1) * limit;
      const schemas = allSchemas.slice(start, start + limit);

      ok(res, {
        schemas,
        pagination: { page, limit, total, pageCount: Math.ceil(total / limit) },
      });
    } catch (error) {
      logger.error({ msg: 'List type schemas error', error });
      const { code, message } = formatGitError(error);
      internalError(res, message, code);
    }
  });

  router.get('/components', requirePermission('collections', 'read'), [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ], async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        respondValidationError(res, 'Invalid schema list parameters', errors.array());
        return;
      }

      const { projectId } = req.params;
      const { branch } = req.query;
      const page = typeof req.query.page === 'number' ? req.query.page : 1;
      const limit = Math.min(typeof req.query.limit === 'number' ? req.query.limit : 50, 100);
      const allSchemas = await gitService.listFiles(projectId, 'schemas/components', branch as string);
      const total = allSchemas.length;
      const start = (page - 1) * limit;
      const schemas = allSchemas.slice(start, start + limit);

      ok(res, {
        schemas,
        pagination: { page, limit, total, pageCount: Math.ceil(total / limit) },
      });
    } catch (error) {
      logger.error({ msg: 'List component schemas error', error });
      const { code, message } = formatGitError(error);
      internalError(res, message, code);
    }
  });

  router.get('/*', requirePermission('collections', 'read'), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const schemaPath = req.params[0];
      const { branch } = req.query;
      if (!schemaPath || schemaPath.includes('..')) {
        respondValidationError(res, 'Invalid schema path');
        return;
      }
      const normalizedPath = normalizeSchemaPath(schemaPath, 'components');
      if (!/\.json$/i.test(normalizedPath)) {
        respondValidationError(res, 'Schema files must use .json extension.');
        return;
      }

      const content = await gitService.readFile(projectId, normalizedPath, branch as string);
      if (content === null) {
        notFound(res, 'Schema not found');
        return;
      }
      ok(res, { path: normalizedPath, content });
    } catch (error) {
      logger.error({ msg: 'Read schema error', error });
      const { code, message } = formatGitError(error);
      internalError(res, message, code);
    }
  });

  router.post('/*', requirePermission('collections', 'update'), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const schemaPath = req.params[0];
      if (!req.user) {
        unauthorized(res, 'Authentication required');
        return;
      }
      const user = req.user;
      if (!schemaPath || schemaPath.includes('..')) {
        respondValidationError(res, 'Invalid schema path');
        return;
      }
      const normalizedPath = normalizeSchemaPath(schemaPath, 'components');
      if (!/\.json$/i.test(normalizedPath)) {
        respondValidationError(res, 'Schema files must use .json extension.');
        return;
      }

      const contentValidation = pageContentSchema.safeParse(req.body);
      if (!contentValidation.success) {
        respondValidationError(res, 'Invalid content', contentValidation.error.errors);
        return;
      }

      const { content, message } = contentValidation.data;
      if (!(await ensureResourceNotLocked(req, res, {
        projectId,
        branch: typeof req.query.branch === 'string' ? req.query.branch : null,
        resourceType: 'schema',
        resourceId: normalizedPath,
      }))) {
        return;
      }
      await saveSchema({
        projectId,
        path: normalizedPath,
        actor: { id: user.id, name: user.name, email: user.email },
      }, content, message, { gitService });

      ok(res, { path: normalizedPath, message: 'Schema saved successfully' });
    } catch (error) {
      if (isLifecycleHookError(error)) {
        respondLifecycleBlocked(res, error);
        return;
      }
      logger.error({ msg: 'Write schema error', error });
      const { code, message } = formatGitError(error);
      internalError(res, message, code);
    }
  });

  router.delete('/*', requirePermission('collections', 'update'), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const schemaPath = req.params[0];
      if (!req.user) {
        unauthorized(res, 'Authentication required');
        return;
      }
      const user = req.user;
      if (!schemaPath || schemaPath.includes('..')) {
        respondValidationError(res, 'Invalid schema path');
        return;
      }
      const normalizedPath = normalizeSchemaPath(schemaPath, 'types');
      if (!(await ensureResourceNotLocked(req, res, {
        projectId,
        branch: typeof req.query.branch === 'string' ? req.query.branch : null,
        resourceType: 'schema',
        resourceId: normalizedPath,
      }))) {
        return;
      }
      await deleteSchema({
        projectId,
        path: normalizedPath,
        actor: { id: user.id, name: user.name, email: user.email },
      }, { gitService });
      ok(res, { path: normalizedPath, message: 'Schema deleted successfully' });
    } catch (error) {
      if (isLifecycleHookError(error)) {
        respondLifecycleBlocked(res, error);
        return;
      }
      logger.error({ msg: 'Delete schema error', error });
      const { code, message } = formatGitError(error);
      internalError(res, message, code);
    }
  });

  return router;
}
